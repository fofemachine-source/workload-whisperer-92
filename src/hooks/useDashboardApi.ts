import { useQuery } from "@tanstack/react-query";

export interface DashboardApiPayload {
  kpis: {
    producaoReal: number;
    metaDiaria: number;
    acumuladoMes: number;
    faltaParaMeta: number;
    viagens: number;
    produtividadeMedia: number;
  };
  producaoDiaria: Array<{ dia: string; Real: number; Prevista?: number }>;
  producaoFrente: Array<{ name: string; value: number }>;
  rankingEscavadeiras: Array<{ equipamento: string; tph: number }>;
  viagensHora: Array<{ hora: string; Real: number }>;
}

export const DASHBOARD_API_URL = "http://192.168.17.15:3001/api/dashboard";

export function useDashboardApi() {
  return useQuery<DashboardApiPayload>({
    queryKey: ["dashboard-api-local"],
    queryFn: async () => {
      const res = await fetch(DASHBOARD_API_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as DashboardApiPayload;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}