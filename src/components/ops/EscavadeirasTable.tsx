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
}

export interface TotalRanking {
  viagens?: number;
  quantidade?: number;
  tonelagem?: number;
  massa?: number;
}

export interface EscavadeirasTableProps {
  /** Dados das escavadeiras vindos do componente pai */
  ranking?: EscavadeiraDetalhe[];
  /** Totais vindos do componente pai */
  total?: TotalRanking;
  /** Estado de carregamento vindo do pai */
  loading?: boolean;
  /** Mensagem de erro vinda do pai */
  error?: string | null;
}

function formatarNumero(valor: number | undefined | null, decimais = 0): string {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

export default function EscavadeirasTable({
  ranking: rankingProp,
  total: totalProp,
  loading: loadingProp,
  error: errorProp,
}: EscavadeirasTableProps) {
  const hasProps = rankingProp !== undefined;
  
  const { data: apiData, isLoading: apiLoading, isError: apiError } = useDashboardApi();

  // Prioriza o ranking detalhado ou o ranking simples da API
  const rawRanking: EscavadeiraDetalhe[] = hasProps
    ? (rankingProp ?? [])
    : ((apiData?.rankingEscavadeirasDetalhado as EscavadeiraDetalhe[]) ?? 
       (apiData?.rankingEscavadeiras as EscavadeiraDetalhe[]) ?? []);

  const totalViagens = hasProps
    ? (totalProp?.viagens ?? totalProp?.quantidade ?? rawRanking.reduce((s, r) => s + Number(r.viagens || r.quantidade || 0), 0))
    : (apiData?.totalRankingEscavadeiras?.viagens ?? rawRanking.reduce((s, r) => s + Number(r.viagens || r.quantidade || 0), 0));

  const totalTonelagem = hasProps
    ? (totalProp?.tonelagem ?? totalProp?.massa ?? rawRanking.reduce((s, r) => s + Number(r.tonelagem || r.massa || 0), 0))
    : (apiData?.totalRankingEscavadeiras?.tonelagem ?? rawRanking.reduce((s, r) => s + Number(r.tonelagem || r.massa || 0), 0));

  const isLoading = hasProps ? Boolean(loadingProp) : apiLoading;
  const erro = hasProps ? errorProp : apiError ? "Falha ao carregar dados da API" : null;

  if (erro) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-black/60 p-4 text-red-400 font-mono text-sm">
        {erro}
      </div>
    );
  }

  if (isLoading && rawRanking.length === 0) {
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
            {rawRanking.map((row, index) => {
              const qtd = Number(row.quantidade ?? row.viagens ?? 0);
              const ton = Number(row.tonelagem ?? row.massa ?? 0);

              return (
                <tr
                  key={`${row.equipamento}-${row.destino || index}-${index}`}
                  className="border-b border-emerald-500/5 text-emerald-300 hover:bg-emerald-500/5 transition-colors"
                >
                  <td className="py-1.5 pr-3 text-cyan-400 font-semibold">{row.equipamento}</td>
                  <td className="py-1.5 pr-3 text-emerald-400/80">{row.material || "—"}</td>
                  <td className="py-1.5 pr-3 text-orange-300/80 truncate max-w-[180px]">
                    {row.frente || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-emerald-400/70 truncate max-w-[180px]">
                    {row.subarea || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-emerald-400/70 truncate max-w-[180px]">
                    {row.destino || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-emerald-400">
                    {formatarNumero(qtd)}
                  </td>
                  <td className="py-1.5 pr-1 text-right text-emerald-300 font-semibold">
                    {formatarNumero(ton)}
                  </td>
                </tr>
              );
            })}

            {rawRanking.length === 0 && (
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
                PRODUÇÃO DO DIA
              </td>
              <td className="py-2.5 pr-3 text-right text-emerald-400 font-bold">
                {formatarNumero(totalViagens)}
              </td>
              <td className="py-2.5 pr-1 text-right text-emerald-300 font-bold">
                {formatarNumero(totalTonelagem)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
