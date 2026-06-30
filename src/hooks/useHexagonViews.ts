import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function useRealtime(table: string, refetch: () => void) {
  useEffect(() => {
    const ch = supabase
      .channel(`${table}_rt_hex`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function useTable<T>(table: string, dias = 2) {
  const q = useQuery({
    queryKey: [table, dias],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      // Tabelas novas não estão nos types ainda; usa cast seguro
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            gte: (c: string, v: string) => {
              order: (
                c: string,
                o: { ascending: boolean },
              ) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
          };
        };
      };
      const res = await client
        .from(table)
        .select("*")
        .gte("data_referencia", desde.toISOString().slice(0, 10))
        .order("data_referencia", { ascending: false });
      // eslint-disable-next-line no-console
      console.log(`[Hexagon] ${table}`, { rows: res.data?.length ?? 0, error: res.error });
      if (res.error) throw res.error;
      return (res.data ?? []) as T[];
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  useRealtime(table, q.refetch);
  return q;
}

export interface ProducaoViewRow {
  id: string;
  data_referencia: string;
  hora: number | null;
  turno: string | null;
  equipamento: string | null;
  frota: string | null;
  frente: string | null;
  toneladas: number | null;
  cargas: number | null;
}
export interface ViagemRow {
  id: string;
  data_referencia: string;
  turno: string | null;
  equipamento: string | null;
  frota: string | null;
  frente_origem: string | null;
  frente_destino: string | null;
  viagens: number | null;
  toneladas: number | null;
  tempo_ciclo_min: number | null;
}
export interface TempoEstadoRow {
  id: string;
  data_referencia: string;
  turno: string | null;
  equipamento: string | null;
  frota: string | null;
  estado: string | null;
  minutos: number | null;
}
export interface TempoCicloRow {
  id: string;
  data_referencia: string;
  turno: string | null;
  equipamento: string | null;
  frota: string | null;
  frente: string | null;
  ciclo_min: number | null;
  viagens: number | null;
}
export interface TempoDetalhadoRow {
  id: string;
  data_referencia: string;
  turno: string | null;
  equipamento: string | null;
  frota: string | null;
  categoria: string | null;
  sub_estado: string | null;
  minutos: number | null;
}

export const useProducaoView = (d = 1) => useTable<ProducaoViewRow>("producao_view", d);
export const useViagens = (d = 1) => useTable<ViagemRow>("viagens_acompanhamento", d);
export const useTempoEstado = (d = 1) => useTable<TempoEstadoRow>("tempo_estado", d);
export const useTempoCiclo = (d = 1) => useTable<TempoCicloRow>("tempo_ciclo", d);
export const useTempoDetalhado = (d = 1) => useTable<TempoDetalhadoRow>("tempo_detalhado", d);