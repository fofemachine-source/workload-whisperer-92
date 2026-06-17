import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProducaoFrenteRow {
  id: string;
  data_referencia: string;
  turno: string;
  relatorio_origem: string;
  frente: string;
  toneladas: number;
  producao_hora: number | null;
  atualizado_em: string;
}

export interface ProducaoEquipamentoRow {
  id: string;
  data_referencia: string;
  turno: string;
  relatorio_origem: string;
  equipamento: string;
  tipo: string | null;
  toneladas: number;
  producao_hora: number | null;
  df: number | null;
  ut: number | null;
  atualizado_em: string;
}

function useRealtime(table: string, refetch: () => void) {
  useEffect(() => {
    const ch = supabase
      .channel(`${table}_rt`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useProducaoFrente(dias = 7) {
  const q = useQuery({
    queryKey: ["producao_frente", dias],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      const res = await supabase
        .from("producao_frente")
        .select("*", { count: "exact" })
        .gte("data_referencia", desde.toISOString().slice(0, 10))
        .order("data_referencia", { ascending: false });
      // eslint-disable-next-line no-console
      console.log("[Supabase] producao_frente", {
        count: res.count,
        rows: res.data?.length ?? 0,
        status: res.status,
        error: res.error,
        data: res.data,
      });
      if (res.error) throw res.error;
      return (res.data ?? []) as ProducaoFrenteRow[];
    },
    refetchInterval: 30_000,
  });
  useRealtime("producao_frente", q.refetch);
  return q;
}

export function useProducaoEquipamento(dias = 7) {
  const q = useQuery({
    queryKey: ["producao_equipamento", dias],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      const res = await supabase
        .from("producao_equipamento")
        .select("*", { count: "exact" })
        .gte("data_referencia", desde.toISOString().slice(0, 10))
        .order("toneladas", { ascending: false });
      // eslint-disable-next-line no-console
      console.log("[Supabase] producao_equipamento", {
        count: res.count,
        rows: res.data?.length ?? 0,
        status: res.status,
        error: res.error,
        data: res.data,
      });
      if (res.error) throw res.error;
      return (res.data ?? []) as ProducaoEquipamentoRow[];
    },
    refetchInterval: 30_000,
  });
  useRealtime("producao_equipamento", q.refetch);
  return q;
}