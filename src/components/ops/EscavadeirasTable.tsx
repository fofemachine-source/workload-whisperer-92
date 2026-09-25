import { useEffect, useState } from "react";
import { useDashboardApi } from "@/hooks/useDashboardApi";

export interface EscavadeiraDetalhe {
  equipamento: string;
  material?: string;
  frente?: string;
  subarea?: string;
  destino?: string;
  quantidade?: number;
  viagens?: number;
  tonelagem?: number;
  massa?: number;
  th?: number;
}

export interface EscavadeiraRanking {
  equipamento: string;
  material?: string;
  frente?: string;
  subarea?: string;
  destino?: string;
  massa?: number;
  viagens?: number;
  horasOp?: number;
  th?: number;
  totalTh?: number;
  detalhes?: EscavadeiraDetalhe[];
}

export interface TotalRanking {
  viagens?: number;
  quantidade?: number;
  tonelagem?: number;
  massa?: number;
  th?: number;
}

export interface EscavadeirasTableProps {
  /** Dados das escavadeiras vindos do componente pai */
  ranking?: EscavadeiraRanking[];
  /** Totais vindos do componente pai */
  total?: TotalRanking;
  /** Estado de carregamento vindo do pai */
  loading?: boolean;
  /** Mensagem de erro vinda do pai */
  error?: string | null;
}

interface EscavadeiraDetalheItem {
  material: string;
  frente: string;
  subarea: string;
  destino: string;
  viagens: number;
  massa: number;
}

interface EscavadeiraGrupo {
  equipamento: string;
  totalTh: number;
  totalViagens: number;
  totalMassa: number;
  detalhes: EscavadeiraDetalheItem[];
}

function formatarNumero(valor: number | undefined | null, decimais = 0): string {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

/** Formatação padrão MineOperate para tonelagem: sem milhar, 3 decimais fixas (ponto), sem 't' */
function formatTon(valor: number | undefined | null): string {
  return Number(valor || 0).toFixed(3);
}

function agruparEscavadeiras(ranking: EscavadeiraRanking[]): EscavadeiraGrupo[] {
  const mapa = new Map<string, EscavadeiraGrupo>();

  for (const item of ranking) {
    const key = item.equipamento || "Outros";

    if (!mapa.has(key)) {
      mapa.set(key, {
        equipamento: key,
        totalTh: item.totalTh ?? item.th ?? 0,
        totalViagens: 0,
        totalMassa: 0,
        detalhes: [],
      });
    }

    const grupo = mapa.get(key)!;

    if (item.totalTh && item.totalTh > 0) {
      grupo.totalTh = item.totalTh;
    } else if (item.th && item.th > 0 && !grupo.totalTh) {
      grupo.totalTh = item.th;
    }

    if (Array.isArray(item.detalhes) && item.detalhes.length > 0) {
      for (const d of item.detalhes) {
        const v = Number(d.viagens || d.quantidade || 0);
        const m = Number(d.massa || d.tonelagem || 0);
        grupo.totalViagens += v;
        grupo.totalMassa += m;
        grupo.detalhes.push({
          material: d.material || item.material || "—",
          frente: d.frente || item.frente || "—",
          subarea: d.subarea || item.subarea || "—",
          destino: d.destino || item.destino || "—",
          viagens: v,
          massa: m,
        });
      }
    } else {
      const v = Number(item.viagens || item.quantidade || 0);
      const m = Number(item.massa || item.tonelagem || 0);
      grupo.totalViagens += v;
      grupo.totalMassa += m;
      grupo.detalhes.push({
        material: item.material || "—",
        frente: item.frente || "—",
        subarea: item.subarea || "—",
        destino: item.destino || "—",
        viagens: v,
        massa: m,
      });
    }
  }

  return Array.from(mapa.values());
}

export default function EscavadeirasTable({
  ranking: rankingProp,
  total: totalProp,
  loading: loadingProp,
  error: errorProp,
}: EscavadeirasTableProps) {
  const hasProps = rankingProp !== undefined;
  
  const { data: apiData, isLoading: apiLoading, isError: apiError } = useDashboardApi();

  const rawRanking: EscavadeiraRanking[] = hasProps
    ? (rankingProp ?? [])
    : ((apiData?.rankingEscavadeirasDetalhado as unknown as EscavadeiraRanking[]) ?? 
       (apiData?.rankingEscavadeiras as unknown as EscavadeiraRanking[]) ?? []);

  const grupos = agruparEscavadeiras(rawRanking);

  const totalViagens = hasProps
    ? (totalProp?.viagens ?? totalProp?.quantidade ?? grupos.reduce((s, g) => s + g.totalViagens, 0))
    : (apiData?.totalRankingEscavadeiras?.viagens ?? grupos.reduce((s, g) => s + g.totalViagens, 0));

  const totalTonelagem = hasProps
    ? (totalProp?.tonelagem ?? totalProp?.massa ?? grupos.reduce((s, g) => s + g.totalMassa, 0))
    : (apiData?.totalRankingEscavadeiras?.tonelagem ?? grupos.reduce((s, g) => s + g.totalMassa, 0));

  const isLoading = hasProps ? Boolean(loadingProp) : apiLoading;
  const erro = hasProps ? errorProp : apiError ? "Falha ao carregar dados da API" : null;

  if (erro) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-black/60 p-4 text-red-400 font-mono text-sm">
        {erro}
      </div>
    );
  }

  if (isLoading && grupos.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-black/60 p-4 text-emerald-400 font-mono text-sm animate-pulse">
        Carregando escavadeiras...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-black/60 p-4 font-mono text-sm shadow-[0_0_20px_rgba(16,185,129,0.08)]">
      <h3 className="mb-3 text-emerald-400 text-xs font-bold tracking-widest uppercase">
        ESCAVADEIRAS
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-emerald-500/70 border-b border-emerald-500/20 text-left">
              <th className="py-2 pr-3 font-semibold">Escavadeira</th>
              <th className="py-2 pr-3 font-semibold">Material</th>
              <th className="py-2 pr-3 font-semibold">Frente de lavra</th>
              <th className="py-2 pr-3 font-semibold">Subárea</th>
              <th className="py-2 pr-3 font-semibold">Destino</th>
              <th className="py-2 pr-3 text-right font-semibold">Quantidade</th>
              <th className="py-2 pr-1 text-right font-semibold">Tonelagem</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => {
              const det = grupo.detalhes[0];
              return (
                <tr
                  key={grupo.equipamento}
                  className="border-b border-emerald-500/5 text-emerald-300 hover:bg-emerald-500/5 transition-colors"
                >
                  <td className="py-1.5 pr-3 text-cyan-400 font-semibold">
                    {grupo.equipamento}
                  </td>
                  <td className="py-1.5 pr-3 text-emerald-400/80">
                    {det?.material || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-orange-300/80 truncate max-w-[180px]">
                    {det?.frente || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-emerald-400/70 truncate max-w-[180px]">
                    {det?.subarea || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-emerald-400/70 truncate max-w-[180px]">
                    {det?.destino || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-emerald-400">
                    {formatarNumero(grupo.totalViagens)}
                  </td>
                  <td className="py-1.5 pr-1 text-right text-emerald-300 font-semibold">
                    {formatTon(grupo.totalMassa)}
                  </td>
                </tr>
              );
            })}

            {grupos.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 text-center text-emerald-500/50">
                  Nenhuma escavadeira registrada.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-emerald-500/40 text-emerald-400 font-bold bg-black/80">
              <td colSpan={5} className="py-2.5 pl-2 uppercase tracking-widest text-xs">
                PRODUÇÃO DO TURNO
              </td>
              <td className="py-2.5 pr-3 text-right text-emerald-400 font-bold">
                {formatarNumero(totalViagens)}
              </td>
              <td className="py-2.5 pr-1 text-right text-emerald-300 font-bold">
                {formatTon(totalTonelagem)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
