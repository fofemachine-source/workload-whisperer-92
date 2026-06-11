import { getPool, sql } from "./db.js";
import "dotenv/config";

const TABLES = [
  "hour_detail_loads",
  "custom_hour_detail_loads",
  "equipments",
];

async function discover() {
  const pool = await getPool();
  for (const table of TABLES) {
    const query = `
      SELECT
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = @table
      ORDER BY ORDINAL_POSITION
    `;
    const result = await pool.request().input("table", sql.VarChar(128), table).query(query);
    console.log(`\n=== ${table} ===`);
    if (result.recordset.length === 0) {
      console.log("  (nenhuma coluna encontrada)");
      continue;
    }
    for (const row of result.recordset) {
      console.log(`  ${row.COLUMN_NAME}  ->  ${row.DATA_TYPE}`);
    }
  }
  await pool.close();
  console.log("\nDescoberta concluída.");
}

discover().catch((err) => {
  console.error("Erro ao descobrir estrutura:", err.message);
  process.exit(1);
});
