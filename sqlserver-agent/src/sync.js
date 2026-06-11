import "dotenv/config";
import axios from "axios";
import { getPool, sql } from "./db.js";

const INGEST_URL = process.env.INGEST_URL;
const AGENT_TOKEN = process.env.AGENT_TOKEN;
const AGENT_NAME = process.env.AGENT_NAME ?? "sqlserver-agent";
const AGENT_VERSION = "2.0.0";
const META_MENSAL = Number(process.env.META_MENSAL ?? 0);

let lastSync = null;
let lastCount = 0;
let sqlStatus = "disconnected";
let ingestStatus = "disconnected";

function log(level, msg, extra) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}` + (extra ? " " + JSON.stringify(extra) : ""));
}

// ---------- Consultas ----------

async function queryLoads(pool, from, to) {
  // Une hour_detail_loads + custom_hour_detail_loads no intervalo
  const r = await pool.request()
    .input("from", sql.DateTime, from)
    .input("to", sql.DateTime, to)
    .query(`
      SELECT
        CAST(load_time AS date)                                   AS data_referencia,
        DATEPART(hour, load_time)                                 AS hora,
        COUNT(*)                                                  AS num_cargas,
        SUM(CAST(tons AS float))                                  AS toneladas,
        SUM(CASE WHEN equipment_type = 'LOAD'      THEN 1 ELSE 0 END) AS cargas_carga,
        SUM(CASE WHEN equipment_type = 'TRANSPORT' THEN 1 ELSE 0 END) AS cargas_transporte
      FROM (
        SELECT load_time, tons, equipment_type FROM dbo.hour_detail_loads
        WHERE load_time BETWEEN @from AND @to
        UNION ALL
        SELECT load_time, tons, equipment_type FROM dbo.custom_hour_detail_loads
        WHERE load_time BETWEEN @from AND @to
      ) x
      GROUP BY CAST(load_time AS date), DATEPART(hour, load_time)
      ORDER BY data_referencia, hora;
    `);
  return r.recordset;
}

async function queryEquipments(pool) {
  const r = await pool.request().query(`
    SELECT
      equipment_id, name, type, status, is_available
    FROM dbo.equipments;
  `);
  return r.recordset;
}

async function queryStates(pool, from, to) {
  // states_for_interval(@from,@to) -> retorna estados por equipamento (operando, manutenção, etc.)
  const r = await pool.request()
    .input("from", sql.DateTime, from)
    .input("to", sql.DateTime, to)
    .query(`SELECT * FROM dbo.states_for_interval(@from, @to);`);
  return r.recordset;
}

// ---------- KPIs ----------

function detectShift(hour) {
  if (hour >= 7 && hour < 19) return "DIA";
  return "NOITE";
}

function calcKpis({ loads, equipments, states }) {
  // Agrupa por data + turno
  const grupos = new Map();
  for (const row of loads) {
    const dia = new Date(row.data_referencia).toISOString().slice(0, 10);
    const turno = detectShift(Number(row.hora));
    const k = `${dia}|${turno}`;
    if (!grupos.has(k)) {
      grupos.set(k, { dia, turno, toneladas: 0, cargas: 0, horas: new Set(), cargaOp: 0, transpOp: 0 });
    }
    const g = grupos.get(k);
    g.toneladas += Number(row.toneladas ?? 0);
    g.cargas += Number(row.num_cargas ?? 0);
    g.horas.add(Number(row.hora));
    g.cargaOp += Number(row.cargas_carga ?? 0);
    g.transpOp += Number(row.cargas_transporte ?? 0);
  }

  // Disponibilidade física e utilização vindas dos estados
  const totEquip = equipments.length || 1;
  const disponiveis = equipments.filter((e) => e.is_available).length;
  const utilizados = equipments.filter((e) => String(e.status ?? "").toUpperCase().includes("OP")).length;

  const totalHoras = states.reduce((s, x) => s + Number(x.total_hours ?? x.hours ?? 0), 0) || 1;
  const horasOp = states
    .filter((x) => String(x.state ?? x.state_name ?? "").toUpperCase().includes("OP"))
    .reduce((s, x) => s + Number(x.total_hours ?? x.hours ?? 0), 0);
  const horasDisp = states
    .filter((x) => !String(x.state ?? x.state_name ?? "").toUpperCase().includes("MANUT"))
    .reduce((s, x) => s + Number(x.total_hours ?? x.hours ?? 0), 0);

  const df = (horasDisp / totalHoras) * 100;
  const ut = (horasOp / Math.max(horasDisp, 1)) * 100;

  // Acumulado mês + projetado
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const acumuladoMes = loads
    .filter((r) => new Date(r.data_referencia) >= primeiroDia)
    .reduce((s, r) => s + Number(r.toneladas ?? 0), 0);
  const diasCorridos = Math.max(1, hoje.getDate());
  const totalDias = ultimoDia.getDate();
  const projetadoMes = (acumuladoMes / diasCorridos) * totalDias;

  // Monta registros para o ingest
  const registros = [];
  for (const g of grupos.values()) {
    const horasTurno = g.horas.size || 12;
    registros.push({
      data_referencia: g.dia,
      turno: g.turno,
      toneladas_total: g.toneladas,
      producao_hora: g.toneladas / horasTurno,
      disponibilidade_fisica_df: Number(df.toFixed(2)),
      utilizacao_ut: Number(ut.toFixed(2)),
      equipamentos_disponiveis: disponiveis,
      equipamentos_utilizados: utilizados,
      carga_operando: g.cargaOp,
      transporte_operando: g.transpOp,
      payload_bruto: {
        cargas: g.cargas,
        horas_amostradas: Array.from(g.horas),
        meta_mensal: META_MENSAL,
        acumulado_mes: acumuladoMes,
        projetado_mes: projetadoMes,
      },
    });
  }
  return registros;
}

// ---------- Envio ----------

async function sendToIngest(registros) {
  if (!INGEST_URL || !AGENT_TOKEN) throw new Error("INGEST_URL e AGENT_TOKEN são obrigatórios");
  const chunk = 500;
  let enviados = 0;
  for (let i = 0; i < registros.length; i += chunk) {
    const slice = registros.slice(i, i + chunk);
    const resp = await axios.post(
      INGEST_URL,
      {
        relatorio: "producao_diaria",
        agente_versao: AGENT_VERSION,
        agente_host: AGENT_NAME,
        registros: slice,
      },
      {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${AGENT_TOKEN}` },
        timeout: 30000,
      }
    );
    enviados += resp.data?.recebidos ?? slice.length;
  }
  ingestStatus = "connected";
  return enviados;
}

// ---------- Loop ----------

export async function runSync() {
  try {
    const pool = await getPool();
    sqlStatus = "connected";

    // Janela: últimos 7 dias até agora (cobre turno em andamento + recálculo)
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    log("info", "Consultando SQL Server", { from: from.toISOString(), to: to.toISOString() });
    const [loads, equipments, states] = await Promise.all([
      queryLoads(pool, from, to),
      queryEquipments(pool),
      queryStates(pool, from, to).catch((e) => {
        log("warn", `states_for_interval falhou: ${e.message}`);
        return [];
      }),
    ]);
    log("info", "Dados obtidos", { loads: loads.length, equipments: equipments.length, states: states.length });

    const registros = calcKpis({ loads, equipments, states });
    if (registros.length === 0) {
      log("warn", "Nenhum registro calculado");
      return;
    }

    const enviados = await sendToIngest(registros);
    lastSync = new Date();
    lastCount = enviados;
    log("info", `Sincronização OK: ${enviados} registros enviados`);
  } catch (e) {
    if (String(e.message).toLowerCase().includes("login") || String(e.message).toLowerCase().includes("connect")) {
      sqlStatus = "error";
    } else {
      ingestStatus = "error";
    }
    log("error", `Falha: ${e.message}`);
  }
}

export function getStats() {
  return { sqlStatus, ingestStatus, lastSync, lastCount };
}