import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATIC_TOKEN = "UEM_MINEOPS_2026";
const REQUIRED_FIELDS = ["data_referencia", "turno", "relatorio_origem"] as const;

// ============================================================
// Suporte a novas views Hexagon/JMineOps (kind != "producao_diaria")
// Payload novo:
//   {
//     kind: "producao_view" | "viagens" | "tempo_estado" | "tempo_ciclo" | "tempo_detalhado",
//     records: [ { ...campos normalizados, raw: {linha bruta} } ],
//     relatorio?, agente_versao?, agente_host?
//   }
// ============================================================
const KIND_TABLE: Record<string, string> = {
  producao_view: "producao_view",
  viagens: "viagens_acompanhamento",
  tempo_estado: "tempo_estado",
  tempo_ciclo: "tempo_ciclo",
  tempo_detalhado: "tempo_detalhado",
};

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashRow(r: Record<string, unknown>) {
  // hash determinístico baseado nas chaves ordenadas + valor da raw
  const stable = JSON.stringify(r, Object.keys(r).sort());
  return await sha256Hex(stable);
}

function normalizeRecord(raw: Record<string, unknown>) {
  const r: Record<string, unknown> = { ...raw };
  // aceitar aliases vindos do agente SQL Server
  if (r.total_de_toneladas != null && r.toneladas_total == null) {
    r.toneladas_total = r.total_de_toneladas;
  }
  delete r.total_de_toneladas;
  // aliases dos novos KPIs
  const aliasMap: Record<string, string> = {
    mina: "producao_mina",
    retaludamento: "producao_retaludamento",
    producao_acumulada_mes: "acumulado_mes",
    acumulado_mensal: "acumulado_mes",
    meta_dia: "meta_diaria",
    meta_mes: "meta_mensal",
    projecao: "projecao_turno",
  };
  for (const [from, to] of Object.entries(aliasMap)) {
    if (r[from] != null && r[to] == null) r[to] = r[from];
    delete r[from];
  }
  return r;
}

// Colunas reconhecidas em producao_diaria (filtra extras como frentes/equipamentos)
const COLUNAS_PRODUCAO = new Set([
  "data_referencia", "turno", "relatorio_origem",
  "toneladas_total", "producao_hora",
  "disponibilidade_fisica_df", "utilizacao_ut",
  "equipamentos_disponiveis", "equipamentos_utilizados",
  "carga_operando", "transporte_operando",
  "producao_mina", "producao_retaludamento",
  "acumulado_mes", "meta_diaria", "meta_mensal", "projecao_turno",
]);

function pickProducao(r: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(r)) if (COLUNAS_PRODUCAO.has(k)) out[k] = r[k];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  async function logSync(params: {
    relatorio: string;
    status: "sucesso" | "erro" | "parcial";
    recebidos: number;
    inseridos?: number;
    atualizados?: number;
    erro?: string | null;
    agente_versao?: string | null;
    agente_host?: string | null;
  }) {
    await supabase.from("sincronizacao_ssrs").insert({
      relatorio: params.relatorio,
      status: params.status,
      registros_recebidos: params.recebidos,
      registros_inseridos: params.inseridos ?? 0,
      registros_atualizados: params.atualizados ?? 0,
      duracao_ms: Date.now() - startedAt,
      mensagem_erro: params.erro ?? null,
      agente_versao: params.agente_versao ?? null,
      agente_host: params.agente_host ?? null,
      finalizado_em: new Date().toISOString(),
    }).then(() => {}, () => {});

    // Log paralelo no sync_logs (formato simplificado para o painel)
    await supabase.from("sync_logs").insert({
      origem: params.relatorio || "sqlserver-agent",
      status: params.status,
      mensagem: params.status === "sucesso"
        ? `${params.inseridos ?? 0} registro(s) gravado(s)`
        : (params.erro ?? "erro desconhecido"),
      ultima_sincronizacao: new Date().toISOString(),
      total_registros: params.inseridos ?? params.recebidos ?? 0,
      erro: params.status === "erro" ? (params.erro ?? null) : null,
    }).then(() => {}, () => {});
  }

  try {
    // 1) Token (Authorization: Bearer UEM_MINEOPS_2026)
    const authHeader = req.headers.get("authorization") || req.headers.get("x-agent-token") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token !== STATIC_TOKEN) {
      await logSync({ relatorio: "desconhecido", status: "erro", recebidos: 0, erro: "Token inválido" });
      return json(401, { error: "Token inválido ou ausente. Use Authorization: Bearer <token>." });
    }

    // 2) Parse JSON
    let raw: unknown;
    try {
      raw = await req.json();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logSync({ relatorio: "desconhecido", status: "erro", recebidos: 0, erro: `JSON inválido: ${msg}` });
      return json(400, { error: "JSON inválido", detalhe: msg });
    }

    // 2.5) Roteamento por kind (novas views Hexagon)
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      const kind = typeof obj.kind === "string" ? obj.kind : null;
      if (kind && KIND_TABLE[kind]) {
        const table = KIND_TABLE[kind];
        const records = Array.isArray(obj.records) ? (obj.records as Record<string, unknown>[]) : [];
        const relatorioK = (typeof obj.relatorio === "string" ? obj.relatorio : "sqlserver-agent") + ":" + kind;
        if (records.length === 0) {
          await logSync({ relatorio: relatorioK, status: "erro", recebidos: 0, erro: "records vazio" });
          return json(400, { error: "records vazio para kind=" + kind });
        }
        const rows: Record<string, unknown>[] = [];
        for (const r of records) {
          if (!r || typeof r !== "object") continue;
          if (!r.data_referencia) continue;
          const rawCol = (r.raw && typeof r.raw === "object") ? r.raw as Record<string, unknown> : r;
          const h = await hashRow(rawCol as Record<string, unknown>);
          rows.push({ ...r, raw: rawCol, raw_hash: h, relatorio_origem: r.relatorio_origem ?? "sqlserver-agent" });
        }
        const { error: upErr, count } = await supabase
          .from(table)
          .upsert(rows, { onConflict: "data_referencia,raw_hash", count: "exact", ignoreDuplicates: false });
        if (upErr) {
          await logSync({ relatorio: relatorioK, status: "erro", recebidos: records.length, erro: upErr.message });
          return json(500, { error: `Falha ao gravar ${table}`, detalhe: upErr.message });
        }
        await logSync({
          relatorio: relatorioK,
          status: "sucesso",
          recebidos: records.length,
          inseridos: count ?? rows.length,
          atualizados: count ?? rows.length,
        });
        return json(200, { ok: true, kind, table, recebidos: records.length, gravados: rows.length });
      }
    }

    // 3) Aceita ARRAY direto, { records: [...] } ou { registros: [...] }
    let registros: Record<string, unknown>[] = [];
    let relatorio = "sqlserver-agent";
    let agenteVersao: string | null = null;
    let agenteHost: string | null = null;

    if (Array.isArray(raw)) {
      registros = raw as Record<string, unknown>[];
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.records)) registros = obj.records as Record<string, unknown>[];
      else if (Array.isArray(obj.registros)) registros = obj.registros as Record<string, unknown>[];
      if (typeof obj.relatorio === "string") relatorio = obj.relatorio;
      if (typeof obj.agente_versao === "string") agenteVersao = obj.agente_versao;
      if (typeof obj.agente_host === "string") agenteHost = obj.agente_host;
    }

    if (!Array.isArray(registros) || registros.length === 0) {
      await logSync({ relatorio, status: "erro", recebidos: 0, erro: "Payload sem registros" });
      return json(400, {
        error: "Payload sem registros",
        detalhe: "Envie um array JSON, ou { records: [...] }, ou { registros: [...] }.",
      });
    }

    // 4) Normaliza + valida campos obrigatórios
    const normalizados: Record<string, unknown>[] = [];
    const erros: Array<{ indice: number; faltando: string[]; registro: unknown }> = [];

    registros.forEach((r, i) => {
      if (!r || typeof r !== "object") {
        erros.push({ indice: i, faltando: ["registro deve ser objeto"], registro: r });
        return;
      }
      const n = normalizeRecord(r as Record<string, unknown>);
      const faltando = REQUIRED_FIELDS.filter((f) => n[f] === undefined || n[f] === null || n[f] === "");
      if (faltando.length > 0) {
        erros.push({ indice: i, faltando: [...faltando], registro: r });
        return;
      }
      normalizados.push(n);
    });

    if (erros.length > 0) {
      await logSync({
        relatorio,
        status: "erro",
        recebidos: registros.length,
        erro: `Campos obrigatórios ausentes em ${erros.length} registro(s)`,
        agente_versao: agenteVersao,
        agente_host: agenteHost,
      });
      return json(400, {
        error: "Campos obrigatórios ausentes",
        obrigatorios: REQUIRED_FIELDS,
        registros_invalidos: erros,
      });
    }

    // 5) Upsert
    const producaoRows = normalizados.map(pickProducao);
    const { error: upErr, count } = await supabase
      .from("producao_diaria")
      .upsert(producaoRows, { onConflict: "data_referencia,turno,relatorio_origem", count: "exact" });

    if (upErr) {
      await logSync({
        relatorio,
        status: "erro",
        recebidos: registros.length,
        erro: upErr.message,
        agente_versao: agenteVersao,
        agente_host: agenteHost,
      });
      return json(500, { error: "Falha ao gravar producao_diaria", detalhe: upErr.message });
    }

    // 5b) Filhos: frentes (N4WN, N4WS, MORRO1, N5SUL, ...) e equipamentos (ranking EH)
    const frentesRows: Record<string, unknown>[] = [];
    const equipRows: Record<string, unknown>[] = [];
    for (const n of normalizados) {
      const ctx = {
        data_referencia: n.data_referencia,
        turno: n.turno,
        relatorio_origem: n.relatorio_origem,
      };
      const frentes = (n.frentes ?? n.por_frente) as unknown;
      if (Array.isArray(frentes)) {
        for (const f of frentes as Record<string, unknown>[]) {
          if (!f?.frente) continue;
          frentesRows.push({
            ...ctx,
            frente: String(f.frente).toUpperCase(),
            toneladas: Number(f.toneladas ?? f.total_toneladas ?? 0),
            producao_hora: f.producao_hora != null ? Number(f.producao_hora) : null,
          });
        }
      }
      const equips = (n.equipamentos ?? n.ranking_eh) as unknown;
      if (Array.isArray(equips)) {
        for (const e of equips as Record<string, unknown>[]) {
          if (!e?.equipamento) continue;
          equipRows.push({
            ...ctx,
            equipamento: String(e.equipamento),
            tipo: (e.tipo as string) ?? null,
            toneladas: Number(e.toneladas ?? 0),
            producao_hora: e.producao_hora != null ? Number(e.producao_hora) : null,
            df: e.df != null ? Number(e.df) : null,
            ut: e.ut != null ? Number(e.ut) : null,
          });
        }
      }
    }

    let frentesGravadas = 0;
    let equipGravados = 0;
    if (frentesRows.length > 0) {
      const { error: fErr, count: fCount } = await supabase
        .from("producao_frente")
        .upsert(frentesRows, { onConflict: "data_referencia,turno,relatorio_origem,frente", count: "exact" });
      if (fErr) console.error("[ingest] frentes erro:", fErr.message);
      else frentesGravadas = fCount ?? frentesRows.length;
    }
    if (equipRows.length > 0) {
      const { error: eErr, count: eCount } = await supabase
        .from("producao_equipamento")
        .upsert(equipRows, { onConflict: "data_referencia,turno,relatorio_origem,equipamento", count: "exact" });
      if (eErr) console.error("[ingest] equipamentos erro:", eErr.message);
      else equipGravados = eCount ?? equipRows.length;
    }

    await logSync({
      relatorio,
      status: "sucesso",
      recebidos: registros.length,
      inseridos: normalizados.length,
      atualizados: count ?? normalizados.length,
      agente_versao: agenteVersao,
      agente_host: agenteHost,
    });

    return json(200, {
      ok: true,
      recebidos: registros.length,
      gravados: normalizados.length,
      frentes_gravadas: frentesGravadas,
      equipamentos_gravados: equipGravados,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logSync({ relatorio: "desconhecido", status: "erro", recebidos: 0, erro: msg });
    return json(500, { error: "Erro interno", detalhe: msg });
  }
});