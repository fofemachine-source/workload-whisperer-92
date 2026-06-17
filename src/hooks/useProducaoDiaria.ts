import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProducaoDiariaRow {
  id: string;
  data_referencia: string;
  turno: string | null;
  relatorio_origem: string;
  toneladas_total: number | null;
  producao_hora: number | null;
  disponibilidade_fisica_df: number | null;
  utilizacao_ut: number | null;
  equipamentos_disponiveis: number | null;
  equipamentos_utilizados: number | null;
  carga_operando: number | null;
  transporte_operando: number | null;
  producao_mina: number | null;
  producao_retaludamento: number | null;
  acumulado_mes: number | null;
  meta_diaria: number | null;
  meta_mensal: number | null;
  projecao_turno: number | null;
  atualizado_em: string;
}

export function useProducaoDiaria(dias = 30) {
  const q = useQuery({
    queryKey: ["producao_diaria", dias],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      const res = await supabase
        .from("producao_diaria")
        .select("*", { count: "exact" })
        .gte("data_referencia", desde.toISOString().slice(0, 10))
        .order("data_referencia", { ascending: false });
      // eslint-disable-next-line no-console
      console.log("[Supabase] producao_diaria", {
        count: res.count,
        rows: res.data?.length ?? 0,
        status: res.status,
        error: res.error,
        data: res.data,
      });
      if (res.error) throw res.error;
      return (res.data ?? []) as ProducaoDiariaRow[];
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const ch = supabase
      .channel("producao_diaria_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "producao_diaria" }, () => q.refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return q;
}

export interface SincronizacaoRow {
  id: string;
  relatorio: string;
  status: "sucesso" | "erro" | "parcial";
  registros_recebidos: number;
  registros_inseridos: number;
  registros_atualizados: number;
  duracao_ms: number | null;
  mensagem_erro: string | null;
  agente_versao: string | null;
  agente_host: string | null;
  iniciado_em: string;
  finalizado_em: string;
}

export function useSincronizacoes(limit = 50) {
  const q = useQuery({
    queryKey: ["sincronizacao_ssrs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sincronizacao_ssrs")
        .select("*")
        .order("finalizado_em", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as SincronizacaoRow[];
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const ch = supabase
      .channel("sync_ssrs_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sincronizacao_ssrs" }, () => q.refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return q;
}