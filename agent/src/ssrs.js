import httpntlm from "httpntlm";
import axios from "axios";
import { parse as parseCsv } from "csv-parse/sync";

function ntlmGet(url) {
  return new Promise((resolve, reject) => {
    httpntlm.get(
      {
        url,
        username: process.env.SSRS_USERNAME?.split("\\").pop() ?? "",
        password: process.env.SSRS_PASSWORD ?? "",
        domain: process.env.SSRS_DOMAIN ?? process.env.SSRS_USERNAME?.split("\\")[0] ?? "",
        workstation: process.env.SSRS_WORKSTATION ?? "",
        binary: true,
      },
      (err, res) => {
        if (err) return reject(err);
        if (res.statusCode >= 400) return reject(new Error(`SSRS HTTP ${res.statusCode}`));
        resolve(res.body);
      },
    );
  });
}

function buildReportUrl(report) {
  const base = (process.env.SSRS_URL ?? "").replace(/\/+$/, "");
  const path = process.env.SSRS_REPORT_PATH ?? report.defaultPath;
  // SSRS aceita CSV via rs:Format=CSV (separador vírgula) ou rs:Format=XML.
  const params = new URLSearchParams({
    "rs:Command": "Render",
    "rs:Format": report.format ?? "CSV",
  });
  for (const [k, v] of Object.entries(report.params ?? {})) {
    params.set(k, String(v));
  }
  return `${base}?${encodeURIComponent(path)}&${params.toString()}`;
}

export async function fetchReportCsv(report) {
  const url = buildReportUrl(report);
  const buf = await ntlmGet(url);
  const text = Buffer.isBuffer(buf) ? buf.toString("utf-8") : String(buf);
  return parseCsv(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });
}

export async function syncReport(report, meta) {
  const rows = await fetchReportCsv(report);
  const registros = rows.map(report.mapRow).filter(Boolean);

  const resp = await axios.post(
    process.env.INGEST_URL,
    {
      relatorio: report.id,
      agente_versao: meta.agente_versao,
      agente_host: meta.agente_host,
      registros,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AGENT_TOKEN}`,
      },
      timeout: 30000,
    },
  );
  return { recebidos: registros.length, response: resp.data };
}