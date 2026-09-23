import React, { useEffect, useState } from "react";
import { useDashboardApi } from "@/hooks/useDashboardApi";

export interface EscavadeiraDetalhe {
  material?: string;
  frente?: string;
  destino?: string;
  viagens?: number;
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
  viagens: number;
  tonelagem: number;
}

export interface EscavadeirasTableProps {
  /** Ranking de escavadeiras vindo do componente pai */
  ranking?: EscavadeiraRanking[];
  /** Totais do ranking vindos do componente pai */
  total?: TotalRanking;
  /** Estado de carregamento vindo do pai */
  loading?: boolean;
  /** Mensagem de erro vinda do pai */
  error?: string | null;
}

interface EscavadeiraDetalheItem {
  material: string;
  frente: string;
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

    // Atualiza o totalTh se houver um valor explícito no item
    if (item.totalTh && item.totalTh > 0) {
      grupo.totalTh = item.totalTh;
    } else if (item.th && item.th > 0 && !grupo.totalTh) {
      grupo.totalTh = item.th;
    }

    // Se o item contiver detalhes explícitos por destino
    if (Array.isArray(item.detalhes) && item.detalhes.length > 0) {
      for (const d of item.detalhes) {
        const v = Number(d.viagens || 0);
        const m = Number(d.massa || 0);
        grupo.totalViagens += v;
        grupo.totalMassa += m;
        grupo.detalhes.push({
          material: d.material || item.material || "—",
          frente: d.frente || item.frente || "—",
          destino: d.destino || item.destino || "—",
          viagens: v,
          massa: m,
        });
      }
    } else {
      // Linha individual de destino
      const v = Number(item.viagens || 0);
      const m = Number(item.massa || 0);
      grupo.totalViagens += v;
      grupo.totalMassa += m;
      grupo.detalhes.push({
        material: item.material || "—",
        frente: item.frente || "—",
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
    : (apiData?.rankingEscavadeiras ?? []);

  const grupos = agruparEscavadeiras(rawRanking);

  const total: TotalRanking = hasProps
    ? (totalProp ?? { viagens: 0, tonelagem: 0 })
    : {
        viagens: grupos.reduce((s, g) => s + g.totalViagens, 0),
        tonelagem: grupos.reduce((s, g) => s + g.totalMassa, 0),
      };

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
        <table className="w-full text-xs">
          <thead>
            <tr className="text-emerald-500/60 border-b border-emerald-500/20">
              <th className="text-left py-1 pr-2 w-6">#</th>
              <th className="text-left py-1 pr-3">Escavadeira</th>
              <th className="text-left py-1 pr-3">Material</th>
              <th className="text-left py-1 pr-3">Frente</th>
              <th className="text-left py-1 pr-3">Destino</th>
              <th className="text-right py-1 pr-3">Qtd</th>
              <th className="text-right py-1 pr-3">Tonelagem</th>
              <th className="text-right py-1">T/H</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo, gIndex) => (
              <React.Fragment key={grupo.equipamento}>
                {/* Linhas de detalhe por destino (sem a coluna T/H) */}
                {grupo.detalhes.map((det, dIndex) => (
                  <tr
                    key={`${grupo.equipamento}-${det.destino}-${dIndex}`}
                    className="border-b border-emerald-500/5 text-emerald-300 hover:bg-emerald-500/5 transition-colors"
                  >
                    <td className="py-1 pr-2 text-emerald-500/60">
                      {dIndex === 0 ? gIndex + 1 : ""}
                    </td>
                    <td className="py-1 pr-3 text-cyan-400 font-semibold">
                      {dIndex === 0 ? grupo.equipamento : ""}
                    </td>
                    <td className="py-1 pr-3 text-emerald-400/80">{det.material}</td>
                    <td className="py-1 pr-3 text-orange-300/80 truncate max-w-[160px]">
                      {det.frente}
                    </td>
                    <td className="py-1 pr-3 text-emerald-400/70 truncate max-w-[160px]">
                      {det.destino}
                    </td>
                    <td className="py-1 pr-3 text-right text-emerald-400">
                      {formatarNumero(det.viagens)}
                    </td>
                    <td className="py-1 pr-3 text-right text-emerald-300">
                      {formatarNumero(det.massa)} t
                    </td>
                    {/* Coluna T/H omitida nas linhas de detalhe por destino */}
                    <td className="py-1 text-right text-emerald-500/30">—</td>
                  </tr>
                ))}

                {/* Linha de subtotal da escavadeira (exibe totalTh do grupo) */}
                <tr className="border-b border-emerald-500/20 bg-emerald-500/10 font-bold">
                  <td colSpan={5} className="py-1.5 pl-2 text-emerald-300 uppercase tracking-wider text-[11px]">
                    Subtotal {grupo.equipamento}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-emerald-400">
                    {formatarNumero(grupo.totalViagens)}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-emerald-300">
                    {formatarNumero(grupo.totalMassa)} t
                  </td>
                  {/* T/H mantido apenas na linha de subtotal da escavadeira usando totalTh */}
                  <td className="py-1.5 text-right font-bold text-white">
                    {formatarNumero(grupo.totalTh, 1)} t/h
                  </td>
                </tr>
              </React.Fragment>
            ))}

            {grupos.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 text-center text-emerald-500/50">
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
              <td colSpan={3} className="py-2.5 pr-2 text-right">
                Viagens: {formatarNumero(total.viagens)}
                <span className="mx-3 text-emerald-500/30">|</span>
                Tonelagem: {formatarNumero(total.tonelagem)} t
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
