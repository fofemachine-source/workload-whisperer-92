import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATIC_TOKEN = "UEM_MINEOPS_2026";
const REQUIRED_FIELDS = ["data_referencia", "turno", "relatorio_origem"] as const;

function normalizeRecord(raw: Record<string, unknown>) {
  const r: Record<string, unknown> = { ...raw };
  // aceitar aliases vindos do agente SQL Server
  if (r.total_de_toneladas != null && r.toneladas_total == null) {
    r.toneladas_total = r.total_de_toneladas;
  }
  delete r.total_de_toneladas;
  return r;
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
      n.atualizado_em = new Date().toISOString();
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
    const { error: upErr, count } = await supabase
      .from("producao_diaria")
      .upsert(normalizados, { onConflict: "data_referencia,turno,relatorio_origem", count: "exact" });

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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logSync({ relatorio: "desconhecido", status: "erro", recebidos: 0, erro: msg });
    return json(500, { error: "Erro interno", detalhe: msg });
  }
});