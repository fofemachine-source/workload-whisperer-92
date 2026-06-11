import "dotenv/config";
import http from "node:http";
import os from "node:os";
import cron from "node-cron";
import { runSync, getStats } from "./sync.js";

const PORT = Number(process.env.PORT ?? 3000);
const SYNC_INTERVAL = Math.max(60, Number(process.env.SYNC_INTERVAL ?? 300));

if (!process.env.INGEST_URL || !process.env.AGENT_TOKEN) {
  console.error("[fatal] INGEST_URL e AGENT_TOKEN são obrigatórios no .env");
  process.exit(1);
}
if (!process.env.SQL_SERVER || !process.env.SQL_DATABASE) {
  console.error("[fatal] SQL_SERVER e SQL_DATABASE são obrigatórios no .env");
  process.exit(1);
}

console.log(`[info] Agente MineOPS SQL Server v2.0.0 iniciado em ${os.hostname()}`);
console.log(`[info] Intervalo: ${SYNC_INTERVAL}s | Destino: ${process.env.INGEST_URL}`);

// Health-check HTTP
http.createServer((req, res) => {
  if (req.url === "/health") {
    const s = getStats();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "online",
      sql_server: s.sqlStatus,
      ingest: s.ingestStatus,
      last_sync: s.lastSync,
      records: s.lastCount,
    }));
  } else {
    res.writeHead(404); res.end();
  }
}).listen(PORT, () => console.log(`[info] Health-check em :${PORT}/health`));

// Primeira execução + cron
runSync();
const minutes = Math.max(1, Math.floor(SYNC_INTERVAL / 60));
cron.schedule(`*/${minutes} * * * *`, runSync);

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));