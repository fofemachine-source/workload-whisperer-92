import "dotenv/config";
import os from "node:os";
import cron from "node-cron";
import { syncReport } from "./ssrs.js";
import { reports } from "./reports/index.js";

const VERSION = "1.0.0";
const HOST = `${os.hostname()} (${process.env.AGENT_NAME ?? "sem-nome"})`;
const INTERVAL = Math.max(60, Number(process.env.SYNC_INTERVAL ?? 300));

function log(level, msg, extra) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}` + (extra ? ` ${JSON.stringify(extra)}` : "");
  console.log(line);
}

async function runAll() {
  for (const report of reports) {
    try {
      log("info", `Sincronizando relatório: ${report.id}`);
      const result = await syncReport(report, { agente_versao: VERSION, agente_host: HOST });
      log("info", `OK: ${report.id}`, { recebidos: result.recebidos });
    } catch (e) {
      log("error", `Falha em ${report.id}: ${e.message}`);
    }
  }
}

log("info", `Agente MineOPS SSRS v${VERSION} iniciado`);
log("info", `Host: ${HOST}`);
log("info", `Intervalo: ${INTERVAL}s | Relatórios: ${reports.map((r) => r.id).join(", ")}`);

if (!process.env.AGENT_TOKEN || !process.env.INGEST_URL) {
  log("error", "AGENT_TOKEN e INGEST_URL são obrigatórios no .env");
  process.exit(1);
}

// Roda imediatamente, depois a cada INTERVAL segundos
runAll();
const expr = `*/${Math.max(1, Math.floor(INTERVAL / 60))} * * * *`;
cron.schedule(expr, runAll);

process.on("SIGINT", () => { log("info", "Encerrando..."); process.exit(0); });
process.on("SIGTERM", () => { log("info", "Encerrando..."); process.exit(0); });