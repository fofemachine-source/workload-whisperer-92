import { useEffect, useState } from "react";

const API_URL = "http://192.168.17.15:3001/api/dashboard";

export interface EscavadeiraRanking {
  equipamento: string;
  material: string;
  frente: string;
  subarea?: string;
  destino: string;
  massa: number;
  viagens: number;
  horasOp: number;
  th: number;
}

export interface TotalRanking {
  viagens: number;
  tonelagem: number;
}

export interface DashboardResponse {
  rankingEscavadeiras: EscavadeiraRanking[];
  totalRankingEscavadeiras: TotalRanking;
}

function formatarNumero(valor: number | undefined | null, decimais = 0): string {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

export default function EscavadeirasTable() {
  const [dados, setDados] = useState<DashboardResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: DashboardResponse = await res.json();
        setDados(json);
        setErro(null);
      } catch (e) {
        console.error("Erro ao buscar dashboard:", e);
        setErro("Falha ao carregar dados da API");
      }
    }

    carregar();
    const intervalo = setInterval(carregar, 30000);
    return () => clearInterval(intervalo);
  }, []);

  if (erro) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-black/60 p-4 text-red-400 font-mono text-sm">
        {erro}
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-black/60 p-4 text-emerald-400 font-mono text-sm animate-pulse">
        Carregando escavadeiras...
      </div>
    );
  }

  const ranking = dados.rankingEscavadeiras || [];
  const total = dados.totalRankingEscavadeiras || { viagens: 0, tonelagem: 0 };

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
            {ranking.map((eq, index) => (
              <tr
                key={eq.equipamento}
                className="border-b border-emerald-500/5 text-emerald-300"
              >
                <td className="py-1 pr-2 text-emerald-500">{index + 1}</td>
                <td className="py-1 pr-3 text-cyan-400">{eq.equipamento}</td>
                <td className="py-1 pr-3 text-emerald-400/80">{eq.material}</td>
                <td className="py-1 pr-3 text-orange-300/80 truncate max-w-[160px]">
                  {eq.frente}
                </td>
                <td className="py-1 pr-3 text-emerald-400/70 truncate max-w-[160px]">
                  {eq.destino}
                </td>
                <td className="py-1 pr-3 text-right text-emerald-400">
                  {formatarNumero(eq.viagens)}
                </td>
                <td className="py-1 pr-3 text-right text-emerald-300">
                  {formatarNumero(eq.massa)} t
                </td>
                {/* Ponto crítico: usa eq.th direto da API, sem recalcular no front */}
                <td className="py-1 text-right font-bold text-white">
                  {formatarNumero(eq.th, 1)} t/h
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-emerald-500/30 text-emerald-400 font-bold">
              <td colSpan={5} className="py-2">
                PRODUÇÃO DO DIA
              </td>
              <td colSpan={3} className="py-2 text-right">
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
