import "dotenv/config";
import axios from "axios";
import { getPool, sql } from "./db.js";

const INGEST_URL = process.env.INGEST_URL;
const AGENT_TOKEN = process.env.AGENT_TOKEN;
const AGENT_NAME = process.env.AGENT_NAME ?? "sqlserver-agent";
const AGENT_VERSION = "3.0.0";
const META_MENSAL = Number(process.env.META_MENSAL ?? 0);
const META_DIARIA = Number(process.env.META_DIARIA ?? 0);
// Janela padrão: últimos N dias (cobre turno em andamento + recálculo)
const WINDOW_DAYS = Number(process.env.WINDOW_DAYS ?? 2);
// Horários dos turnos (ajuste se sua operação for diferente)
// turno1 = 07:00–14:59  ·  turno2 = 15:00–22:59  ·  turno3 = 23:00–06:59
function detectShift(hour) {
  if (hour >= 7  && hour < 15) return "turno1";
  if (hour >= 15 && hour < 23) return "turno2";
  return "turno3";
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
// Consultas T-SQL — base: dbo.hour_detail_loads + custom_hour_detail_loads
//
// Colunas esperadas (ajuste os COALESCE conforme o schema real do jmineops_uem):
//   load_time          datetime           -- timestamp da carga
//   shovel_id / loader -- equipamento de carga (EH / pá-carregadeira)
//   truck_id           -- caminhão (não usado no ranking EH)
//   material_tonnage   -- toneladas da carga (fallback: tons)
//   load_count         -- nº de cargas (fallback: 1)
//   blast_region       -- frente (N4WN, N4WS, MORRO1, N5SUL ...)  fallback: grade / location
// ============================================================

const SHIFT_CASE = `
  CASE
    WHEN DATEPART(hour, load_time) >= 7  AND DATEPART(hour, load_time) < 15 THEN 'turno1'
    WHEN DATEPART(hour, load_time) >= 15 AND DATEPART(hour, load_time) < 23 THEN 'turno2'
    ELSE 'turno3'
  END
`;

// CTE base: unifica as duas tabelas com nomes normalizados
const CTE_LOADS = `
  WITH loads AS (
    SELECT
      load_time,
      COALESCE(TRY_CAST(material_tonnage AS float), TRY_CAST(tons AS float), 0)        AS toneladas,
      COALESCE(TRY_CAST(load_count       AS int),   1)                                 AS cargas,
      COALESCE(blast_region, grade, location, 'INDEFINIDA')                            AS frente,
      COALESCE(shovel_id, loader, equipment_id, 'DESCONHECIDA')                        AS equipamento,
      COALESCE(equipment_type, 'LOAD')                                                 AS equipment_type
    FROM dbo.hour_detail_loads
    WHERE load_time BETWEEN @from AND @to
    UNION ALL
    SELECT
      load_time,
      COALESCE(TRY_CAST(material_tonnage AS float), TRY_CAST(tons AS float), 0),
      COALESCE(TRY_CAST(load_count       AS int),   1),
      COALESCE(blast_region, grade, location, 'INDEFINIDA'),
      COALESCE(shovel_id, loader, equipment_id, 'DESCONHECIDA'),
      COALESCE(equipment_type, 'LOAD')
    FROM dbo.custom_hour_detail_loads
    WHERE load_time BETWEEN @from AND @to
  )
`;

async function queryAggregateTurno(pool, from, to) {
  // Agrupa por data_referencia + turno (toneladas + horas distintas)
  const q = `
    ${CTE_LOADS}
    SELECT
      CAST(load_time AS date)         AS data_referencia,
      ${SHIFT_CASE}                   AS turno,
      SUM(toneladas)                  AS toneladas_total,
      SUM(cargas)                     AS cargas,
      COUNT(DISTINCT DATEPART(hour, load_time)) AS horas_distintas
    FROM loads
    GROUP BY CAST(load_time AS date), ${SHIFT_CASE}
    ORDER BY data_referencia, turno;
  `;
  const r = await pool.request().input("from", sql.DateTime, from).input("to", sql.DateTime, to).query(q);
  return r.recordset;
}

async function queryAggregateFrente(pool, from, to) {
  const q = `
    ${CTE_LOADS}
    SELECT
      CAST(load_time AS date)        AS data_referencia,
      ${SHIFT_CASE}                  AS turno,
      frente,
      SUM(toneladas)                 AS toneladas,
      COUNT(DISTINCT DATEPART(hour, load_time)) AS horas_distintas
    FROM loads
    GROUP BY CAST(load_time AS date), ${SHIFT_CASE}, frente
    ORDER BY data_referencia, turno, toneladas DESC;
  `;
  const r = await pool.request().input("from", sql.DateTime, from).input("to", sql.DateTime, to).query(q);
  return r.recordset;
}

async function queryAggregateEquipamento(pool, from, to) {
  const q = `
    ${CTE_LOADS}
    SELECT
      CAST(load_time AS date)        AS data_referencia,
      ${SHIFT_CASE}                  AS turno,
      equipamento,
      MAX(equipment_type)            AS tipo,
      SUM(toneladas)                 AS toneladas,
      SUM(cargas)                    AS cargas,
      COUNT(DISTINCT DATEPART(hour, load_time)) AS horas_distintas
    FROM loads
    WHERE equipment_type IN ('LOAD','SHOVEL','EH') OR equipment_type IS NULL
    GROUP BY CAST(load_time AS date), ${SHIFT_CASE}, equipamento
    ORDER BY data_referencia, turno, toneladas DESC;
  `;
  const r = await pool.request().input("from", sql.DateTime, from).input("to", sql.DateTime, to).query(q);
  return r.recordset;
}

async function queryEquipmentsStatus(pool) {
  const r = await pool.request().query(`
    SELECT equipment_id, name, type, status, is_available
    FROM dbo.equipments;
  `);
  return r.recordset;
}

// ============================================================
// Monta payload no formato aceito pela Edge Function ingest-mineops
// ============================================================
function buildPayload({ porTurno, porFrente, porEquip, equipments }) {
  const disponiveis = equipments.filter((e) => e.is_available).length;
  const utilizados  = equipments.filter((e) => String(e.status ?? "").toUpperCase().includes("OP")).length;
  const totEquip    = equipments.length || 1;
  const dfPct = (disponiveis / totEquip) * 100;
  const utPct = (utilizados  / Math.max(disponiveis, 1)) * 100;

  // Acumulado mês a partir dos próprios turnos retornados
  const hoje = new Date();
  const monthKey = hoje.toISOString().slice(0, 7);
  const acumuladoMes = porTurno
    .filter((t) => (new Date(t.data_referencia).toISOString().slice(0, 7) === monthKey))
    .reduce((s, t) => s + Number(t.toneladas_total || 0), 0);

  // Índices auxiliares
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
  const equipIdx   = idx(porEquip);

  // Identifica turno mais recente para calcular projeção
  const turnoMaisRecente = porTurno[porTurno.length - 1];

  const registros = porTurno.map((t) => {
    const dia    = new Date(t.data_referencia).toISOString().slice(0, 10);
    const turno  = t.turno;
    const k      = `${dia}|${turno}`;
    const horas  = Number(t.horas_distintas || 0) || 8;
    const ton    = Number(t.toneladas_total || 0);
    const tonH   = ton / horas;

    // Projeção do turno: extrapola pra 8h se ainda não fechou
    const projecaoTurno = (t === turnoMaisRecente) ? tonH * 8 : ton;

    const frentesArr = (frentesIdx.get(k) || []).map((f) => ({
      frente: String(f.frente).toUpperCase(),
      toneladas: Number(f.toneladas || 0),
      producao_hora: Number(f.toneladas || 0) / (Number(f.horas_distintas || 0) || horas),
    }));

    const equipArr = (equipIdx.get(k) || []).map((e) => ({
      equipamento: String(e.equipamento),
      tipo: e.tipo ?? null,
      toneladas: Number(e.toneladas || 0),
      producao_hora: Number(e.toneladas || 0) / (Number(e.horas_distintas || 0) || horas),
    }));

    // Heurística: Mina = frentes que NÃO contêm "RETALUD"; Retaludamento = resto
    const producaoMina       = frentesArr.filter((f) => !/RETALUD/i.test(f.frente)).reduce((s, f) => s + f.toneladas, 0);
    const producaoRetalud    = frentesArr.filter((f) =>  /RETALUD/i.test(f.frente)).reduce((s, f) => s + f.toneladas, 0);

    return {
      data_referencia: dia,
      turno,
      relatorio_origem: AGENT_NAME,
      toneladas_total: ton,
      producao_hora: Number(tonH.toFixed(2)),
      producao_mina: Number(producaoMina.toFixed(2)),
      producao_retaludamento: Number(producaoRetalud.toFixed(2)),
      acumulado_mes: Number(acumuladoMes.toFixed(2)),
      meta_diaria: META_DIARIA || null,
      meta_mensal: META_MENSAL || null,
      projecao_turno: Number(projecaoTurno.toFixed(2)),
      disponibilidade_fisica_df: Number(dfPct.toFixed(2)),
      utilizacao_ut: Number(utPct.toFixed(2)),
      equipamentos_disponiveis: disponiveis,
      equipamentos_utilizados: utilizados,
      frentes: frentesArr,
      equipamentos: equipArr,
    };
  });

  return registros;
}

// ============================================================
// Envio HTTP para a Edge Function
// ============================================================
async function sendToIngest(registros) {
  if (!INGEST_URL || !AGENT_TOKEN) throw new Error("INGEST_URL e AGENT_TOKEN são obrigatórios");
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${AGENT_TOKEN}` },
        timeout: 30000,
      });
      log("info", "← resposta Supabase", resp.data);
      totalRecebidos += resp.data?.recebidos ?? slice.length;
      totalGravados  += resp.data?.gravados  ?? 0;
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

export async function runSync() {
  try {
    const pool = await getPool();
    sqlStatus = "connected";

    const to = new Date();
    const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    log("info", "Consultando SQL Server", { from: from.toISOString(), to: to.toISOString() });
    const [porTurno, porFrente, porEquip, equipments] = await Promise.all([
      queryAggregateTurno(pool, from, to),
      queryAggregateFrente(pool, from, to),
      queryAggregateEquipamento(pool, from, to),
      queryEquipmentsStatus(pool).catch((e) => {
        log("warn", `equipments status falhou: ${e.message}`);
        return [];
      }),
    ]);
    log("info", "Dados obtidos", {
      turnos: porTurno.length,
      frentes: porFrente.length,
      equipamentos: porEquip.length,
      equipments_status: equipments.length,
    });

    const registros = buildPayload({ porTurno, porFrente, porEquip, equipments });
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