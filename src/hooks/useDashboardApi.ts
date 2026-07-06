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
  rankingEscavadeiras: Array<{
    equipamento: string;
    th: number;
    massa?: number;
    viagens?: number;
    material?: string;
    frente?: string;
    subarea?: string;
    destino?: string;
  }>;
  rankingEscavadeirasDetalhado?: Array<{
    equipamento: string;
    destino?: string;
    quantidade?: number;
    viagens?: number;
    tonelagem?: number;
    massa?: number;
  }>;
  viagensCR?: Array<{
    cr?: string;
    escavadeira?: string;
    origem?: string;
    destino?: string;
    material?: string;
    quantidade?: number;
    tonelagem?: number;
    inicio?: string;
    fim?: string;
    ciclo?: number;
  }>;
  viagensHora: Array<{ hora: string | number; viagens: number }>;
}

export const DASHBOARD_API_URL = "http://192.168.17.15:3001/api/dashboard";
export const API_BASE = "http://192.168.17.15:3001/api";

export function useDashboardApi() {
  return useQuery<DashboardApiPayload>({
    queryKey: ["dashboard-api-local"],
    queryFn: async () => {
      const res = await fetch(DASHBOARD_API_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as DashboardApiPayload;
    },
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

function makeExtraHook<T = any>(key: string, path: string) {
  return function useExtra() {
    return useQuery<T[]>({
      queryKey: [key],
      queryFn: async () => {
        const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (Array.isArray(json)) return json as T[];
        if (Array.isArray(json?.data)) return json.data as T[];
        if (Array.isArray(json?.rows)) return json.rows as T[];
        if (Array.isArray(json?.items)) return json.items as T[];
        return [] as T[];
      },
      refetchInterval: 5_000,
      refetchOnWindowFocus: true,
      retry: 1,
    });
  };
}

export const useTempoApi = makeExtraHook<Record<string, any>>("api-tempo", "/tempo?limit=100");
export const useProducaoApi = makeExtraHook<Record<string, any>>("api-producao", "/producao?limit=500");
export const useViagensApi = makeExtraHook<Record<string, any>>("api-viagens", "/viagens?limit=500");
export const useTempoCicloApi = makeExtraHook<Record<string, any>>("api-tempo-ciclo", "/tempo-ciclo?limit=100");