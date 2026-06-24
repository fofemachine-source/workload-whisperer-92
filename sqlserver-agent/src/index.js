require("dotenv/config");
const http = require("node:http");
const os = require("node:os");
const { runSync, getStats, testConnection } = require("./sync.js");

const PORT = Number(process.env.PORT || 3000);
// Default 5 minutos (300s)
const SYNC_INTERVAL_MS = Math.max(60, Number(process.env.SYNC_INTERVAL || 300)) * 1000;
const RECONNECT_MS = 60 * 1000; // 1 minuto

if (!process.env.INGEST_URL || !process.env.AGENT_TOKEN) {
  console.error("[fatal] INGEST_URL e AGENT_TOKEN são obrigatórios no .env");
  process.exit(1);
}
if (!process.env.SQL_SERVER || !process.env.SQL_DATABASE) {
  console.error("[fatal] SQL_SERVER e SQL_DATABASE são obrigatórios no .env");
  process.exit(1);
}

console.log(`[info] Agente MineOPS SQL Server iniciado em ${os.hostname()}`);
console.log(`[info] Intervalo de sync: ${SYNC_INTERVAL_MS / 1000}s | Destino: ${process.env.INGEST_URL}`);
console.log(`[info] SQL Server: ${process.env.SQL_SERVER} | DB: ${process.env.SQL_DATABASE}`);

let nextSyncAt = null;

// Health-check HTTP — formato pedido pelo painel
http.createServer((req, res) => {
  if (req.url === "/health") {
    const s = getStats();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "online",
      sqlServer: s.sqlStatus === "connected" ? "connected" : "disconnected",
      database: process.env.SQL_DATABASE,
      lastSync: s.lastSync,
      nextSync: nextSyncAt,
      origin: "agente-sqlserver",
      ingest: s.ingestStatus,
      records: s.lastCount,
      agentVersion: s.agentVersion,
      host: os.hostname(),
    }));
  } else {
    res.writeHead(404); res.end();
  }
}).listen(PORT, () => console.log(`[info] Health-check em :${PORT}/health`));

// Loop perpétuo de sincronização com auto-reconexão.
// - Em caso de sucesso: agenda próxima execução em SYNC_INTERVAL_MS (5 min).
// - Em caso de falha de conexão SQL: tenta reconectar em RECONNECT_MS (1 min).
async function loop() {
  // Sempre testa conexão antes de sincronizar
  const conn = await testConnection();
  if (!conn.ok) {
    console.error(`[error] SQL Server inacessível: ${conn.error}. Nova tentativa em ${RECONNECT_MS / 1000}s.`);
    nextSyncAt = new Date(Date.now() + RECONNECT_MS).toISOString();
    setTimeout(loop, RECONNECT_MS);
    return;
  }

  try {
    await runSync();
  } catch (e) {
    console.error(`[error] Falha no ciclo de sync: ${e.message || e}`);
  }

  nextSyncAt = new Date(Date.now() + SYNC_INTERVAL_MS).toISOString();
  setTimeout(loop, SYNC_INTERVAL_MS);
}

loop();

// Nunca deixa o processo morrer por exceção não tratada
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));