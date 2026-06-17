// sqlserver-agent/src/sync.js
// CommonJS — JMineOps real schema (dbo.hour_detail_loads)
// AGENT_VERSION 3.0.1-jmineops-real

require("dotenv/config");
const axios = require("axios");
const sql = require("mssql");

const AGENT_VERSION = "3.0.1-jmineops-real";
const AGENT_NAME = process.env.AGENT_NAME || "sqlserver-agent";
const INGEST_URL = process.env.INGEST_URL;
const AGENT_TOKEN = process.env.AGENT_TOKEN;
const META_DIARIA = process.env.META_DIARIA ? Number(process.env.META_DIARIA) : null;
const META_MENSAL = process.env.META_MENSAL ? Number(process.env.META_MENSAL) : null;
const WINDOW_DAYS = Number(process.env.WINDOW_DAYS || 2);

const sqlConfig = {
  server: process.env.SQL_SERVER,
  port: Number(process.env.SQL_PORT || 1433),
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: String(process.env.SQL_ENCRYPT || "false") === "true",
    trustServerCertificate: String(process.env.SQL_TRUST_SERVER_CERTIFICATE || "true") === "true",
    enableArithAbort: true,
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 60000,
  connectionTimeout: 15000,
};

let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig).catch((e) => {
      poolPromise = null;
      throw e;
    });
  }
  return poolPromise;
}

let lastSync = null;
let lastCount = 0;
let sqlStatus = "disconnected";
let ingestStatus = "disconnected";

function log(level, msg, extra) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}` + (extra ? " " + JSON.stringify(extra) : ""));
}

// ============================================================
// Queries — schema real do JMineOps
//   colunas: time, shift, shovel, shovel_equipment_type,
//            blast_region, material_tonnage, load_count, material,
//            grade, truck, truck_equipment_type
// ============================================================

async function queryAggregateTurno(pool, from, to) {
  const q = `
    SELECT
      CAST([time] AS date)         AS data_referencia,
      [shift]                      AS turno,
      SUM(material_tonnage)        AS toneladas_total,
      SUM(load_count)              AS cargas
    FROM dbo.hour_detail_loads
    WHERE [time] BETWEEN @from AND @to
    GROUP BY CAST([time] AS date), [shift]
    ORDER BY data_referencia, turno;
  `;
  const r = await pool.request()
    .input("from", sql.DateTime, from)
    .input("to", sql.DateTime, to)
    .query(q);
  return r.recordset;
}

async function queryAggregateFrente(pool, from, to) {
  const q = `
    SELECT
      CAST([time] AS date)         AS data_referencia,
      [shift]                      AS turno,
      COALESCE(blast_region, 'INDEFINIDA') AS frente,
      SUM(material_tonnage)        AS toneladas
    FROM dbo.hour_detail_loads
    WHERE [time] BETWEEN @from AND @to
    GROUP BY CAST([time] AS date), [shift], COALESCE(blast_region, 'INDEFINIDA')
    ORDER BY data_referencia, turno, toneladas DESC;
  `;
  const r = await pool.request()
    .input("from", sql.DateTime, from)
    .input("to", sql.DateTime, to)
    .query(q);
  return r.recordset;
}

async function queryAggregateEquipamento(pool, from, to) {
  const q = `
    SELECT
      CAST([time] AS date)         AS data_referencia,
      [shift]                      AS turno,
      shovel                       AS equipamento,
      MAX(shovel_equipment_type)   AS tipo,
      SUM(material_tonnage)        AS toneladas,
      SUM(load_count)              AS cargas
    FROM dbo.hour_detail_loads
    WHERE [time] BETWEEN @from AND @to
      AND shovel IS NOT NULL
    GROUP BY CAST([time] AS date), [shift], shovel
    ORDER BY data_referencia, turno, toneladas DESC;
  `;
  const r = await pool.request()
    .input("from", sql.DateTime, from)
    .input("to", sql.DateTime, to)
    .query(q);
  return r.recordset;
}

// ============================================================
// Payload — formato aceito pela Edge Function ingest-mineops
// ============================================================
function buildPayload({ porTurno, porFrente, porEquip }) {
  const hoje = new Date();
  const monthKey = hoje.toISOString().slice(0, 7);
  const acumuladoMes = porTurno
    .filter((t) => new Date(t.data_referencia).toISOString().slice(0, 7) === monthKey)
    .reduce((s, t) => s + Number(t.toneladas_total || 0), 0);

  const idx = (arr) => {
    const m = new Map();
    for (const r of arr) {
      const k = `${new Date(r.data_referencia).toISOString().slice(0, 10)}|${r.turno}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  };
  const frentesIdx = idx(porFrente);
  const equipIdx = idx(porEquip);

  return porTurno.map((t) => {
    const dia = new Date(t.data_referencia).toISOString().slice(0, 10);
    const turno = String(t.turno);
    const k = `${dia}|${turno}`;
    const ton = Number(t.toneladas_total || 0);
    const tonH = ton / 8;

    const frentesArr = (frentesIdx.get(k) || []).map((f) => ({
      frente: String(f.frente).toUpperCase(),
      toneladas: Number(f.toneladas || 0),
      producao_hora: Number(f.toneladas || 0) / 8,
    }));

    const equipArr = (equipIdx.get(k) || []).map((e) => ({
      equipamento: String(e.equipamento),
      tipo: e.tipo ?? null,
      toneladas: Number(e.toneladas || 0),
      producao_hora: Number(e.toneladas || 0) / 8,
    }));

    return {
      data_referencia: dia,
      turno,
      relatorio_origem: AGENT_NAME,
      toneladas_total: Number(ton.toFixed(2)),
      producao_hora: Number(tonH.toFixed(2)),
      producao_mina: Number(ton.toFixed(2)),
      producao_retaludamento: 0,
      acumulado_mes: Number(acumuladoMes.toFixed(2)),
      meta_diaria: META_DIARIA,
      meta_mensal: META_MENSAL,
      projecao_turno: Number((tonH * 8).toFixed(2)),
      disponibilidade_fisica_df: null,
      utilizacao_ut: null,
      frentes: frentesArr,
      equipamentos: equipArr,
    };
  });
}

// ============================================================
// HTTP — envio para Edge Function
// ============================================================
async function sendToIngest(registros) {
  if (!INGEST_URL || !AGENT_TOKEN) {
    throw new Error("INGEST_URL e AGENT_TOKEN são obrigatórios");
  }
  const chunk = 200;
  let totalRecebidos = 0;
  let totalGravados = 0;

  for (let i = 0; i < registros.length; i += chunk) {
    const slice = registros.slice(i, i + chunk);
    log("info", `→ POST ingest-mineops (${slice.length} registros)`, {
      sample: {
        data_referencia: slice[0]?.data_referencia,
        turno: slice[0]?.turno,
        toneladas_total: slice[0]?.toneladas_total,
        frentes: slice[0]?.frentes?.length ?? 0,
        equipamentos: slice[0]?.equipamentos?.length ?? 0,
      },
    });
    try {
      const resp = await axios.post(INGEST_URL, slice, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AGENT_TOKEN}`,
        },
        timeout: 30000,
      });
      log("info", "← resposta Supabase", resp.data);
      totalRecebidos += resp.data?.recebidos ?? slice.length;
      totalGravados += resp.data?.gravados ?? 0;
    } catch (e) {
      const detalhe = e.response?.data ?? e.message;
      log("error", "← falha ingest", detalhe);
      throw new Error(typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe));
    }
  }
  ingestStatus = "connected";
  return { totalRecebidos, totalGravados };
}

// ============================================================
// Loop principal
// ============================================================
async function runSync() {
  try {
    const pool = await getPool();
    sqlStatus = "connected";

    const to = new Date();
    const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    log("info", `Consultando SQL Server (agent ${AGENT_VERSION})`, {
      from: from.toISOString(),
      to: to.toISOString(),
    });

    const [porTurno, porFrente, porEquip] = await Promise.all([
      queryAggregateTurno(pool, from, to),
      queryAggregateFrente(pool, from, to),
      queryAggregateEquipamento(pool, from, to),
    ]);

    log("info", "Dados obtidos", {
      turnos: porTurno.length,
      frentes: porFrente.length,
      equipamentos: porEquip.length,
    });

    const registros = buildPayload({ porTurno, porFrente, porEquip });
    if (registros.length === 0) {
      log("warn", "Nenhum registro calculado");
      return;
    }

    log("info", "Payload pronto", {
      registros: registros.length,
      preview: registros[registros.length - 1],
    });

    const { totalRecebidos, totalGravados } = await sendToIngest(registros);
    lastSync = new Date();
    lastCount = totalGravados;
    log("info", `Sincronização OK: recebidos=${totalRecebidos} gravados=${totalGravados}`);
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.toLowerCase().includes("login") || msg.toLowerCase().includes("connect")) {
      sqlStatus = "error";
    } else {
      ingestStatus = "error";
    }
    log("error", `Falha: ${msg}`);
  }
}

function getStats() {
  return { sqlStatus, ingestStatus, lastSync, lastCount, agentVersion: AGENT_VERSION };
}

module.exports = { runSync, getStats, AGENT_VERSION };
