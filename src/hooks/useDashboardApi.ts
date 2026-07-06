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
  producaoDiaria: Array<{ data: string; real: number; previsto?: number }>;
  producaoFrente: Array<{ frente: string; massa: number }>;
  rankingEscavadeiras: Array<{ equipamento: string; th: number; massa?: number; viagens?: number }>;
  viagensHora: Array<{ hora: string | number; viagens: number }>;
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