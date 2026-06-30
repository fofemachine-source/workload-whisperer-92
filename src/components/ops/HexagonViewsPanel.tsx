import { useMemo } from "react";
import { CardShell } from "@/components/ops/CardShell";
import {
  useViagens,
  useTempoCiclo,
  useTempoDetalhado,
} from "@/hooks/useHexagonViews";

const NEON = "#22c55e";
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmt1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function HexagonViewsPanel() {
  const { data: viagens } = useViagens(1);
  const { data: ciclos } = useTempoCiclo(1);
  const { data: detalhado } = useTempoDetalhado(1);

  const viagensAgg = useMemo(() => {
    const map = new Map<string, { equipamento: string; viagens: number; toneladas: number }>();
    (viagens ?? []).forEach((v) => {
      const k = v.equipamento || "—";
      const cur = map.get(k) ?? { equipamento: k, viagens: 0, toneladas: 0 };
      cur.viagens += Number(v.viagens || 0);
      cur.toneladas += Number(v.toneladas || 0);
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.viagens - a.viagens).slice(0, 8);
  }, [viagens]);

  const ciclosAgg = useMemo(() => {
    const map = new Map<string, { equipamento: string; soma: number; n: number; viagens: number }>();
    (ciclos ?? []).forEach((c) => {
      const k = c.equipamento || "—";
      const cur = map.get(k) ?? { equipamento: k, soma: 0, n: 0, viagens: 0 };
      const m = Number(c.ciclo_min || 0);
      if (m > 0) {
        cur.soma += m;
        cur.n += 1;
      }
      cur.viagens += Number(c.viagens || 0);
      map.set(k, cur);
    });
    return Array.from(map.values())
      .map((r) => ({ equipamento: r.equipamento, ciclo: r.n ? r.soma / r.n : 0, viagens: r.viagens }))
      .filter((r) => r.ciclo > 0)
      .sort((a, b) => a.ciclo - b.ciclo)
      .slice(0, 8);
  }, [ciclos]);

  const tempoCats = useMemo(() => {
    const map = new Map<string, number>();
    (detalhado ?? []).forEach((d) => {
      const k = d.categoria || d.sub_estado || "—";
      map.set(k, (map.get(k) ?? 0) + Number(d.minutos || 0));
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1;
    return Array.from(map.entries())
      .map(([cat, min]) => ({ cat, min, pct: (min / total) * 100 }))
      .sort((a, b) => b.min - a.min)
      .slice(0, 8);
  }, [detalhado]);

  return (
    <div className="grid gap-3 grid-cols-12">
      <div className="col-span-12 lg:col-span-4 flex">
        <CardShell title="🚛 VIAGENS POR EQUIPAMENTO" className="flex-1">
          {viagensAgg.length === 0 ? (
            <p className="text-sm text-muted-foreground font-mono">Sem dados reais disponíveis.</p>
          ) : (
            <div className="space-y-1.5">
              {viagensAgg.map((v) => (
                <div key={v.equipamento} className="flex items-center gap-2 text-sm font-mono">
                  <span className="w-24 truncate text-foreground">{v.equipamento}</span>
                  <span className="flex-1 text-right text-mining-yellow font-bold">{fmt(v.viagens)}</span>
                  <span className="w-24 text-right text-mining-green">{fmt(v.toneladas)} t</span>
                </div>
              ))}
            </div>
          )}
        </CardShell>
      </div>

      <div className="col-span-12 lg:col-span-4 flex">
        <CardShell title="⏱️ TEMPO DE CICLO MÉDIO (min)" className="flex-1">
          {ciclosAgg.length === 0 ? (
            <p className="text-sm text-muted-foreground font-mono">Sem dados reais disponíveis.</p>
          ) : (
            <div className="space-y-1.5">
              {ciclosAgg.map((c) => (
                <div key={c.equipamento} className="flex items-center gap-2 text-sm font-mono">
                  <span className="w-24 truncate text-foreground">{c.equipamento}</span>
                  <span className="flex-1 text-right text-mining-green font-bold">{fmt1(c.ciclo)} min</span>
                  <span className="w-20 text-right text-muted-foreground text-xs">{fmt(c.viagens)} v</span>
                </div>
              ))}
            </div>
          )}
        </CardShell>
      </div>

      <div className="col-span-12 lg:col-span-4 flex">
        <CardShell title="🕒 TEMPO DETALHADO POR CATEGORIA" className="flex-1">
          {tempoCats.length === 0 ? (
            <p className="text-sm text-muted-foreground font-mono">Sem dados reais disponíveis.</p>
          ) : (
            <div className="space-y-1.5">
              {tempoCats.map((t) => (
                <div key={t.cat} className="text-sm font-mono">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-foreground">{t.cat}</span>
                    <span className="text-mining-yellow font-bold">{fmt(t.min)} min · {fmt1(t.pct)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-mining-green"
                      style={{ width: `${Math.min(100, t.pct)}%`, boxShadow: `0 0 6px ${NEON}` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardShell>
      </div>
    </div>
  );
}