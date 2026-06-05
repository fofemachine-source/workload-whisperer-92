import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProducaoDiariaPayload {
  data_referencia: string;
  turno?: string | null;
  toneladas_total?: number | null;
  producao_hora?: number | null;
  disponibilidade_fisica_df?: number | null;
  utilizacao_ut?: number | null;
  equipamentos_disponiveis?: number | null;
  equipamentos_utilizados?: number | null;
  carga_operando?: number | null;
  transporte_operando?: number | null;
  payload_bruto?: Record<string, unknown> | null;
}

interface IngestBody {
  relatorio: string;
  agente_versao?: string;
  agente_host?: string;
  registros: ProducaoDiariaPayload[];
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("x-agent-token") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token ausente" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const tokenHash = await sha256Hex(token);
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("agente_tokens")
      .select("id, ativo, revogado_em")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (tokenErr || !tokenRow || !tokenRow.ativo || tokenRow.revogado_em) {
      return new Response(JSON.stringify({ error: "Token inválido ou revogado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = (await req.json()) as IngestBody;
    if (!body?.relatorio || !Array.isArray(body.registros)) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upsert
    let inseridos = 0;
    let atualizados = 0;
    let erro: string | null = null;

    if (body.registros.length > 0) {
      const rows = body.registros.map((r) => ({
        ...r,
        relatorio_origem: body.relatorio,
        atualizado_em: new Date().toISOString(),
      }));
      const { error: upErr, count } = await supabase
        .from("producao_diaria")
        .upsert(rows, { onConflict: "data_referencia,turno,relatorio_origem", count: "exact" });
      if (upErr) {
        erro = upErr.message;
      } else {
        atualizados = count ?? rows.length;
        inseridos = rows.length;
      }
    }

    await supabase.from("agente_tokens").update({ ultimo_uso_em: new Date().toISOString() }).eq("id", tokenRow.id);

    await supabase.from("sincronizacao_ssrs").insert({
      relatorio: body.relatorio,
      status: erro ? "erro" : "sucesso",
      registros_recebidos: body.registros.length,
      registros_inseridos: inseridos,
      registros_atualizados: atualizados,
      duracao_ms: Date.now() - startedAt,
      mensagem_erro: erro,
      agente_versao: body.agente_versao ?? null,
      agente_host: body.agente_host ?? null,
      finalizado_em: new Date().toISOString(),
    });

    if (erro) {
      return new Response(JSON.stringify({ ok: false, erro }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, recebidos: body.registros.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("sincronizacao_ssrs").insert({
      relatorio: "desconhecido",
      status: "erro",
      registros_recebidos: 0,
      duracao_ms: Date.now() - startedAt,
      mensagem_erro: msg,
      finalizado_em: new Date().toISOString(),
    }).then(() => {}, () => {});
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});