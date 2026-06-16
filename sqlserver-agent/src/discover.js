import { getPool, sql } from "./db.js";
import "dotenv/config";

/**
 * Descoberta de schema do JMineOps (SQL Server).
 * - Lista colunas de tabelas/views via INFORMATION_SCHEMA.COLUMNS
 * - Lista parâmetros de funções (TVF) via INFORMATION_SCHEMA.PARAMETERS
 * - Amostra 1 linha de cada objeto p/ confirmar tipos reais
 */

const TABLES = ["hour_detail_loads", "custom_hour_detail_loads", "equipments"];
const FUNCTIONS = ["states_for_interval"];

function printRow(prefix, row) {
  const extra = [];
  if (row.CHARACTER_MAXIMUM_LENGTH) extra.push(`len=${row.CHARACTER_MAXIMUM_LENGTH}`);
  if (row.NUMERIC_PRECISION) extra.push(`prec=${row.NUMERIC_PRECISION}`);
  if (row.IS_NULLABLE) extra.push(`nullable=${row.IS_NULLABLE}`);
  console.log(`  ${prefix.padEnd(40, " ")} ${row.DATA_TYPE.padEnd(16, " ")} ${extra.join(" ")}`);
}

async function describeTable(pool, name) {
  const res = await pool
    .request()
    .input("name", sql.VarChar(128), name)
    .query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE,
             CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @name
      ORDER BY ORDINAL_POSITION
    `);
  console.log(`\n=== TABLE/VIEW dbo.${name} (${res.recordset.length} colunas) ===`);
  if (res.recordset.length === 0) {
    console.log("  (não encontrada)");
    return;
  }
  for (const row of res.recordset) printRow(row.COLUMN_NAME, row);

  // Amostra (1 linha) para confirmar dados
  try {
    const sample = await pool.request().query(`SELECT TOP 1 * FROM dbo.${name}`);
    if (sample.recordset.length) {
      console.log(`  -- AMOSTRA (1 linha) --`);
      console.log(JSON.stringify(sample.recordset[0], null, 2).split("\n").map((l) => "    " + l).join("\n"));
    } else {
      console.log("  -- AMOSTRA: tabela vazia --");
    }
  } catch (e) {
    console.log(`  -- AMOSTRA falhou: ${e.message} --`);
  }
}

async function describeFunction(pool, name) {
  // Parâmetros
  const params = await pool
    .request()
    .input("name", sql.VarChar(128), name)
    .query(`
      SELECT SPECIFIC_NAME, PARAMETER_NAME, DATA_TYPE, PARAMETER_MODE
      FROM INFORMATION_SCHEMA.PARAMETERS
      WHERE SPECIFIC_SCHEMA = 'dbo' AND SPECIFIC_NAME = @name
      ORDER BY ORDINAL_POSITION
    `);
  console.log(`\n=== FUNCTION dbo.${name}() ===`);
  if (params.recordset.length === 0) {
    console.log("  (função não encontrada ou sem parâmetros)");
  } else {
    console.log("  Parâmetros:");
    for (const p of params.recordset) {
      console.log(`    ${(p.PARAMETER_NAME || "(retorno)").padEnd(30)} ${p.DATA_TYPE} [${p.PARAMETER_MODE || "RETURN"}]`);
    }
  }

  // Tenta descobrir colunas do resultado (TVF). Para isso usamos
  // sys.dm_exec_describe_first_result_set se possível.
  try {
    const sig = params.recordset
      .filter((p) => p.PARAMETER_NAME)
      .map(() => "NULL")
      .join(", ");
    const probe = `SELECT name, system_type_name, is_nullable
                   FROM sys.dm_exec_describe_first_result_set(
                     N'SELECT * FROM dbo.${name}(${sig})', NULL, 0)`;
    const cols = await pool.request().query(probe);
    if (cols.recordset.length) {
      console.log("  Colunas retornadas:");
      for (const c of cols.recordset) {
        console.log(`    ${String(c.name).padEnd(30)} ${c.system_type_name} nullable=${c.is_nullable}`);
      }
    }
  } catch (e) {
    console.log(`  (não foi possível descrever resultado: ${e.message})`);
  }
}

async function main() {
  console.log("Conectando ao SQL Server...");
  const pool = await getPool();
  console.log("Conectado.\n");

  for (const t of TABLES) await describeTable(pool, t);
  for (const f of FUNCTIONS) await describeFunction(pool, f);

  await pool.close();
  console.log("\nDescoberta concluída. Cole TODO o output acima no chat da Lovable.");
}

main().catch((err) => {
  console.error("ERRO:", err.message);
  process.exit(1);
});
