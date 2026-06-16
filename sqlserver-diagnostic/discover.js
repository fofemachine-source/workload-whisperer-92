import sql from "mssql";
import fs from "fs";
import "dotenv/config";

const config = {
  server: process.env.SQL_SERVER ?? "192.168.17.15",
  port: Number(process.env.SQL_PORT ?? 1433),
  database: process.env.SQL_DATABASE ?? "jmineops_uem",
  user: process.env.SQL_USER ?? "consulta",
  password: process.env.SQL_PASSWORD ?? "consulta",
  options: {
    encrypt: String(process.env.SQL_ENCRYPT ?? "false") === "true",
    trustServerCertificate:
      String(process.env.SQL_TRUST_SERVER_CERTIFICATE ?? "true") === "true",
    enableArithAbort: true,
    ...(process.env.SQL_INSTANCE ? { instanceName: process.env.SQL_INSTANCE } : {}),
  },
  requestTimeout: 60000,
  connectionTimeout: 15000,
};

const SAMPLE_TABLES = [
  "hour_detail_loads",
  "custom_hour_detail_loads",
  "equipments",
];

function header(title) {
  const line = "=".repeat(title.length + 4);
  console.log(`\n${line}\n  ${title}\n${line}`);
}

async function listTables(pool) {
  const r = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  return r.recordset.map((x) => x.TABLE_NAME);
}

async function listColumns(pool, table) {
  const r = await pool
    .request()
    .input("name", sql.VarChar(128), table)
    .query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH,
             NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @name
      ORDER BY ORDINAL_POSITION
    `);
  return r.recordset.map((c) => ({
    name: c.COLUMN_NAME,
    type: c.DATA_TYPE,
    length: c.CHARACTER_MAXIMUM_LENGTH ?? null,
    precision: c.NUMERIC_PRECISION ?? null,
    scale: c.NUMERIC_SCALE ?? null,
    nullable: c.IS_NULLABLE === "YES",
  }));
}

async function sampleRows(pool, table, top = 5) {
  try {
    const r = await pool.request().query(`SELECT TOP ${top} * FROM dbo.[${table}]`);
    return r.recordset;
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  console.log(`Conectando em ${config.server}:${config.port}/${config.database} ...`);
  const pool = await sql.connect(config);
  console.log("Conectado.\n");

  const output = {
    generated_at: new Date().toISOString(),
    server: config.server,
    database: config.database,
    tables: {},
    samples: {},
  };

  header("TABELAS dbo");
  const tables = await listTables(pool);
  console.log(`Encontradas ${tables.length} tabelas no schema dbo.`);

  for (const t of tables) {
    const cols = await listColumns(pool, t);
    output.tables[t] = cols;
    console.log(`\n-- dbo.${t} (${cols.length} colunas)`);
    for (const c of cols) {
      const extra = [];
      if (c.length) extra.push(`len=${c.length}`);
      if (c.precision) extra.push(`p=${c.precision},s=${c.scale ?? 0}`);
      extra.push(c.nullable ? "NULL" : "NOT NULL");
      console.log(`   ${c.name.padEnd(40)} ${c.type.padEnd(16)} ${extra.join(" ")}`);
    }
  }

  header("AMOSTRAS (TOP 5)");
  for (const t of SAMPLE_TABLES) {
    console.log(`\n>>> dbo.${t}`);
    const rows = await sampleRows(pool, t, 5);
    output.samples[t] = rows;
    console.log(JSON.stringify(rows, null, 2));
  }

  fs.writeFileSync("schema.json", JSON.stringify(output, null, 2), "utf8");
  console.log("\nschema.json gravado com sucesso.");

  await pool.close();
}

main().catch((err) => {
  console.error("\nERRO:", err.message);
  process.exit(1);
});