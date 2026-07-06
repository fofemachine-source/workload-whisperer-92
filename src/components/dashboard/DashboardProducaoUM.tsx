import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Filter, AlertTriangle, Loader2 } from "lucide-react";
import { useDashboardApi, useProducaoApi, useViagensApi } from "@/hooks/useDashboardApi";

/* ---------- helpers ---------- */
const fmt = (n: number, d = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
const brDate = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  const meses = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d}/${meses[Number(m)] ?? m}`;
};

const FRENTE_COLORS = ["#38bdf8", "#22d3ee", "#0ea5e9", "#f59e0b", "#22c55e", "#a855f7", "#ef4444", "#eab308"];

/* ---------- filtro operacional fixo ----------
 * Caminhões válidos: começam com "CR"
 * Escavadeiras válidas: whitelist abaixo
 * NUNCA considerar equipamentos começando com "CB" (Gelado)
 */
const ESCAVADEIRAS_VALIDAS = new Set([
  "EH4026", "EH4039", "EH4041", "EH4047", "EH4050",
  "EH4035", "EH5003", "EH5004", "EH5036",
]);
const normEquip = (v: unknown) =>
  String(v ?? "").replace(/[-\s]/g, "").toUpperCase();
const isCaminhaoValido = (v: unknown) => {
  const n = normEquip(v);
  return n.startsWith("CR") && !n.startsWith("CB");
};
const isEscavadeiraValida = (v: unknown) => {
  const n = normEquip(v);
  if (n.startsWith("CB")) return false;
  return ESCAVADEIRAS_VALIDAS.has(n);
};
/** Regra completa: caminhão CR + escavadeira na whitelist. */
const linhaValida = (equipamento: unknown, equipamento_carga: unknown) =>
  isCaminhaoValido(equipamento) && isEscavadeiraValida(equipamento_carga);

const pick = (obj: Record<string, any>, keys: string[]) => {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null && obj?.[k] !== "") return obj[k];
  }
  return undefined;
};
const toNum = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtHora = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  // Já é HH:mm ou HH:mm:ss
  const m = s.match(/(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  // Tenta parsear como Date
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return s;
};


/* ---------- shared card ---------- */
function Panel({
  title,
  children,
  className = "",
  right,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className={`bg-[hsl(220_45%_9%/0.85)] border border-mining-blue/20 rounded-md shadow-[0_0_24px_-14px_hsl(var(--mining-blue)/0.6)] flex flex-col ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between px-3 pt-2">
          <p className="text-[11px] font-bold tracking-wider text-mining-blue uppercase">{title}</p>
          {right}
        </div>
      )}
      <div className="p-3 pt-2 flex-1 min-h-0">{children}</div>
    </div>
  );
}

/* ---------- filter select ---------- */
function FilterField({
  label,
  value,
  onChange,
  options,
  type = "select",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  type?: "select" | "date";
}) {
  return (
    <div className="flex flex-col min-w-[110px]">
      <span className="text-[9px] tracking-widest text-mining-blue/70 font-bold uppercase">{label}</span>
      {type === "date" ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[hsl(220_40%_12%)] border border-mining-blue/25 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-mining-blue"
        />
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[hsl(220_40%_12%)] border border-mining-blue/25 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-mining-blue"
        >
          <option value="">Todos</option>
          {(options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/* ---------- main dashboard ---------- */
export default function DashboardProducaoUM() {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioAno = `${new Date().getFullYear()}-01-01`;
  const [dtIni, setDtIni] = useState(inicioAno);
  const [dtFim, setDtFim] = useState(hoje);

  const { data, isLoading, isError, error, dataUpdatedAt } = useDashboardApi();
  const { data: producaoData } = useProducaoApi();
  const { data: viagensData } = useViagensApi();

  const kpis = data?.kpis;
  const producaoReal = Number(kpis?.producaoReal ?? 0);
  const metaDiaria = Number(kpis?.metaDiaria ?? 0);
  const acumuladoMes = Number(kpis?.acumuladoMes ?? 0);
  const tphMedio = Number(kpis?.produtividadeMedia ?? 0);
  const totalPrevisto = metaDiaria; // sem série prevista da API
  const variacao = producaoReal - metaDiaria;

  const dailySeries = useMemo(
    () =>
      (data?.producaoDiaria ?? []).map((d) => ({
        dia: d.data,
        Real: Number(d.real ?? 0),
        Prevista: Number(d.previsto ?? 0),
      })),
    [data],
  );

  const frenteAgg = useMemo(() => {
    const arr = (data?.producaoFrente ?? [])
      .map((f) => ({ name: String(f.frente), value: Number(f.massa ?? 0) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, r) => s + r.value, 0) || 1;
    return arr.map((r) => ({ ...r, pct: (r.value / total) * 100 }));
  }, [data]);

  const topEscav = useMemo(
    () => {
      if (!Array.isArray(data?.rankingEscavadeiras) || data.rankingEscavadeiras.length === 0) return [];

      return data.rankingEscavadeiras
        .map((e: any) => {
          const equipamento = String(e.equipamento ?? "").trim();
          const equipamentoNorm = normEquip(equipamento);
          const linhasProducao = (producaoData ?? []).filter((r) => {
            const carga = pick(r, ["equipamento_carga", "escavadeira", "equipamentoCarga"]);
            return normEquip(carga) === equipamentoNorm;
          });

          const destinoAgg = new Map<string, { destino: string; viagens: number; massa: number }>();
          for (const r of linhasProducao) {
            const destino = String(pick(r, ["destino", "destination"]) ?? "—");
            const viagens = toNum(pick(r, ["quantidade", "viagens", "viagem", "trips"])) || 1;
            const massa = toNum(pick(r, ["massa", "material_tonnage", "tonelagem", "tonnage"]));
            const atual = destinoAgg.get(destino) ?? { destino, viagens: 0, massa: 0 };
            atual.viagens += viagens;
            atual.massa += massa;
            destinoAgg.set(destino, atual);
          }

          const destinos = Array.from(destinoAgg.values())
            .filter((d) => d.destino !== "—" || d.viagens > 0 || d.massa > 0)
            .sort((a, b) => b.massa - a.massa);

          const firstProd = linhasProducao[0] ?? {};
          const destinoRanking = e.destino ? String(e.destino) : "";
          const destinoLinhas = destinos.map((d) => d.destino).filter((d) => d && d !== "—");
          const destinoResumo = destinoLinhas.length > 0 ? destinoLinhas.slice(0, 2).join(" / ") : destinoRanking;
          const viagensRanking = Number(e.viagens ?? 0);
          const massaRanking = Number(e.massa ?? 0);

          return {
            equipamento,
            th: Number(e.th ?? e.tph ?? 0),
            viagens: destinos.length ? destinos.reduce((s, d) => s + d.viagens, 0) : viagensRanking,
            massa: destinos.length ? destinos.reduce((s, d) => s + d.massa, 0) : massaRanking,
            material: e.material ?? pick(firstProd, ["material", "material_name"]),
            subarea: e.subarea ?? pick(firstProd, ["subarea", "subárea", "origem", "frente_lavra", "frenteDeLavra"]),
            destino: destinoResumo,
            destinos: destinos.length
              ? destinos
              : destinoRanking
                ? [{ destino: destinoRanking, viagens: viagensRanking, massa: massaRanking }]
                : [],
          };
        })
        .filter((e) => isEscavadeiraValida(e.equipamento))
        .filter((e) => e.th > 0 || e.massa > 0)
        .sort((a, b) => b.th - a.th)
        .slice(0, 6);
    },
    [data, producaoData],
  );

  const totalTphEscav = topEscav.reduce((total, item) => total + Number(item.th || 0), 0);

  const viagensPorHora = useMemo(() => {
    const base = Array.from({ length: 24 }, (_, h) => ({
      hora: String(h).padStart(2, "0"),
      Real: 0,
    }));
    (data?.viagensHora ?? []).forEach((v) => {
      const h = Number(String(v.hora).slice(0, 2));
      if (h >= 0 && h < 24) base[h].Real = Number(v.viagens ?? 0);
    });
    return base;
  }, [data]);

  const prodSeries = useMemo(
    () =>
      dailySeries.map((d) => ({
        dia: d.dia,
        Real: d.Real,
        Prevista: d.Prevista,
      })),
    [dailySeries],
  );

  const mediaViagens = 0;
  const dfMedio = 0;
  const utMedio = 0;

  const detalhamento = useMemo(
    () =>
      (producaoData ?? [])
        .filter((r) => linhaValida(pick(r, ["equipamento"]), pick(r, ["equipamento_carga"])))
        .slice(0, 50)
        .map((r) => ({
        dia: String(pick(r, ["dia", "data"]) ?? "—"),
        hora: String(pick(r, ["hora"]) ?? "—"),
        equipamento: pick(r, ["equipamento"]) ?? null,
        equipamento_carga: pick(r, ["equipamento_carga"]) ?? null,
        massa: toNum(pick(r, ["massa"])),
        viagens: toNum(pick(r, ["viagens"])),
        origem: pick(r, ["origem"]) ?? null,
        destino: pick(r, ["destino"]) ?? null,
        material: pick(r, ["material"]) ?? null,
        operador: pick(r, ["operador"]) ?? null,
      })),
    [producaoData],
  );

  const acompViagens = useMemo(
    () =>
      (viagensData ?? [])
        .filter((r) => {
          const eq = String(pick(r, ["equipamento"]) ?? "").trim().toUpperCase();
          return eq.startsWith("CR");
        })
        .map((r) => ({
        equipamento: pick(r, ["equipamento"]) ?? null,
        event_start: pick(r, ["event_start"]) ?? null,
        event_end: pick(r, ["event_end"]) ?? null,
        tempo_ciclo: toNum(pick(r, ["tempo_ciclo"])),
        origem: pick(r, ["origem"]) ?? null,
        destino: pick(r, ["destino"]) ?? null,
        material: pick(r, ["material"]) ?? null,
        operador: pick(r, ["operador"]) ?? null,
        massa: toNum(pick(r, ["massa", "material_tonnage", "tonelagem"])),
        viagem: toNum(pick(r, ["viagem", "viagens"])) || 1,
      })),
    [viagensData],
  );

  const limparFiltros = () => {
    setDtIni(inicioAno);
    setDtFim(hoje);
  };

  const ultima = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div className="min-h-screen bg-[hsl(220_50%_5%)] text-foreground p-2 md:p-3 font-sans">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 items-stretch">
        <Panel className="col-span-12 lg:col-span-4 !p-0">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex items-center justify-center w-14 h-14 rounded bg-mining-yellow text-background font-black text-lg leading-tight text-center">
              U&amp;M
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
                DASHBOARD DE PRODUÇÃO
              </h1>
              <p className="text-[11px] font-mono tracking-widest text-mining-blue/80">
                U&amp;M MINERAÇÃO · Hexagon / JMineOps
              </p>
            </div>
          </div>
        </Panel>
        <Panel className="col-span-12 lg:col-span-8 !p-0">
          <div className="flex items-center justify-end gap-4 px-3 py-3 h-full">
            <div className="flex flex-col text-right text-[11px] font-mono text-mining-blue/80 leading-tight">
              <span>Atualização automática: <span className="text-mining-blue font-bold">60s</span></span>
              <span>Última atualização: <span className="text-foreground font-bold">{ultima ? ultima.toLocaleString("pt-BR") : "—"}</span></span>
            </div>
            <button
              onClick={limparFiltros}
              className="flex items-center gap-1 border border-mining-blue/40 hover:bg-mining-blue/10 px-3 py-1.5 rounded text-[11px] font-bold text-mining-blue uppercase tracking-wider"
            >
              <Filter className="w-3 h-3" /> Limpar Filtros
            </button>
          </div>
        </Panel>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
        <Kpi label="Produção Prevista (t)" value={fmt(totalPrevisto)} color="text-mining-blue" />
        <Kpi label="Produção Real (t)" value={fmt(producaoReal)} color="text-mining-blue" />
        <Kpi
          label="Variação (t)"
          value={fmt(variacao)}
          color={variacao < 0 ? "text-mining-yellow" : "text-mining-green"}
        />
        <Kpi label="Meta Diária (t)" value={fmt(metaDiaria)} color="text-mining-blue" />
        <Kpi label="Acumulado Mês (t)" value={fmt(acumuladoMes)} color="text-mining-blue" />
        <Kpi
          label="Produção Total das Escavadeiras (t/h)"
          value={`${fmt(totalTphEscav)} t/h`}
          color="text-mining-green"
          borderClass="border-mining-green/60"
        />
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-12 gap-2 mt-2 items-stretch">
        <Panel title="Produção Diária (t)" className="col-span-12 lg:col-span-4 min-h-[360px]">
          {dailySeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="dia" stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Prevista" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Real" fill="#22c55e" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Produção por Frente (t)" className="col-span-12 lg:col-span-3 min-h-[360px]">
          {frenteAgg.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-full flex items-center">
              <div className="w-2/3 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={frenteAgg}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={1}
                      stroke="none"
                      label={(e: { pct?: number }) => `${(e.pct ?? 0).toFixed(1)}%`}
                      labelLine={false}
                    >
                      {frenteAgg.map((_, i) => (
                        <Cell key={i} fill={FRENTE_COLORS[i % FRENTE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v) + " t"} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/3 space-y-1 text-[10px] font-mono">
                {frenteAgg.map((f, i) => (
                  <div key={f.name} className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 inline-block rounded-sm"
                      style={{ background: FRENTE_COLORS[i % FRENTE_COLORS.length] }}
                    />
                    <span className="truncate text-foreground">{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Top 6 Escavadeiras" className="col-span-12 lg:col-span-5 lg:row-span-3">
          {topEscav.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 min-h-0 overflow-auto space-y-1.5 pr-1">
                {topEscav.map((e, i) => {
                  const maxTh = topEscav[0].th || 1;
                  const pct = Math.max(2, (e.th / maxTh) * 100);
                  return (
                    <div
                      key={e.equipamento}
                      className="bg-mining-surface-2/70 border border-mining-blue/15 rounded-sm px-2 py-1.5 shadow-[inset_0_1px_0_hsl(var(--mining-blue)/0.08)]"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center rounded-sm bg-mining-yellow text-background text-[10px] font-black">
                            {i + 1}
                          </span>
                          <span className="text-xs font-bold text-foreground tracking-tight">
                            {e.equipamento}
                          </span>
                        </div>
                        <span className="text-base font-black text-mining-blue leading-none text-glow-blue">
                          {fmt(e.th)} t/h
                        </span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-x-4 text-[10px] font-mono text-muted-foreground mb-1 leading-tight">
                        <div className="space-y-0.5 min-w-0">
                          {e.material && (
                            <div className="truncate"><span className="text-mining-blue/80">Material:</span> <span className="text-mining-yellow font-bold">{e.material}</span></div>
                          )}
                          {e.subarea && (
                            <div className="truncate"><span className="text-mining-blue/80">Subárea:</span> <span className="text-foreground">{e.subarea}</span></div>
                          )}
                          {e.destino && (
                            <div className="truncate"><span className="text-mining-blue/80">Destino:</span> <span className="text-foreground">{e.destino}</span></div>
                          )}
                        </div>
                        <div className="text-right space-y-0.5 whitespace-nowrap">
                          <div><span className="text-mining-blue/80">Viagens:</span> <span className="text-mining-blue font-bold">{fmt(e.viagens)}</span></div>
                          <div><span className="text-mining-blue/80">Tonelagem:</span> <span className="text-foreground font-bold">{fmt(e.massa)} t</span></div>
                        </div>
                      </div>
                      {e.destinos.length > 0 && (
                        <div className="mb-1 text-[9px] font-mono">
                          <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-x-3 px-1 text-mining-blue/70 leading-tight">
                            <span>Destino</span>
                            <span className="text-right">Quantidade (Viagens)</span>
                            <span className="text-right">Tonelagem (t)</span>
                          </div>
                          {e.destinos.map((destino) => (
                            <div key={destino.destino} className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] gap-x-3 px-1 leading-tight">
                              <span className="truncate text-foreground">{destino.destino}</span>
                              <span className="text-right text-foreground">{fmt(destino.viagens)}</span>
                              <span className="text-right text-foreground">{fmt(destino.massa)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-mining-blue shadow-[0_0_12px_hsl(var(--mining-blue)/0.85)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-mining-blue/30 mt-2 pt-2 flex items-center justify-between px-1 text-[11px] font-mono">
                <span className="font-bold uppercase tracking-wider text-foreground">Total Top 6</span>
                <div className="flex items-center gap-6">
                  <span className="text-muted-foreground">Viagens: <span className="text-mining-blue font-bold">{fmt(topEscav.reduce((s, e) => s + e.viagens, 0))}</span></span>
                  <span className="text-muted-foreground">Tonelagem: <span className="text-mining-green font-bold">{fmt(topEscav.reduce((s, e) => s + e.massa, 0))} t</span></span>
                </div>
              </div>
            </div>
          )}
        </Panel>
        <Panel title="Produtividade (t/h)" className="col-span-12 lg:col-span-4">
          {prodSeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prodSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="dia" stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="Meta" stroke="#f59e0b" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Previsto" stroke="#38bdf8" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Real" stroke="#22c55e" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Viagens por Hora" className="col-span-12 lg:col-span-2">
          {viagensPorHora.every((v) => v.Real === 0) ? (
            <Empty />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={viagensPorHora} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="hora" stroke="#7fb2d9" tick={{ fontSize: 8 }} interval={1} />
                  <YAxis stroke="#7fb2d9" tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="Real" fill="#22d3ee" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <div className="col-span-12 lg:col-span-1 grid grid-rows-4 gap-2">
          <MiniKpi label="Produtividade Média" value={fmt(tphMedio)} unit="t/h" />
          <MiniKpi label="Viagens Médias" value={fmt(mediaViagens)} unit="viag/h" />
          <MiniKpi label="DF% Médio" value={dfMedio ? `${fmt(dfMedio, 1)}%` : "—"} />
          <MiniKpi label="UT% Médio" value={utMedio ? `${fmt(utMedio, 1)}%` : "—"} />
        </div>

        <Panel title="Detalhamento de Produção" className="col-span-12 lg:col-span-4">
          {detalhamento.length === 0 ? (
            <Empty />
          ) : (
            <div className="max-h-64 overflow-auto">
            <table className="w-full text-[10px] font-mono">
              <thead className="text-mining-blue/70">
                <tr className="border-b border-mining-blue/20">
                  <Th>Dia</Th><Th>Hora</Th><Th>Equip.</Th><Th>Carga</Th><Th>Origem</Th><Th>Destino</Th><Th>Material</Th><Th>Operador</Th>
                  <Th className="text-right">Massa</Th><Th className="text-right">Viag.</Th>
                </tr>
              </thead>
              <tbody>
                {detalhamento.map((d, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <Td>{d.dia}</Td>
                    <Td>{d.hora}</Td>
                    <Td>{String(d.equipamento ?? "—")}</Td>
                    <Td>{String(d.equipamento_carga ?? "—")}</Td>
                    <Td>{String(d.origem ?? "—")}</Td>
                    <Td>{String(d.destino ?? "—")}</Td>
                    <Td>{String(d.material ?? "—")}</Td>
                    <Td>{String(d.operador ?? "—")}</Td>
                    <Td className="text-right text-mining-green">{fmt(d.massa, 2)}</Td>
                    <Td className="text-right text-mining-blue">{fmt(d.viagens)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-mining-navy/95 border-t border-mining-blue/40">
                <tr className="font-bold">
                  <Td colSpan={8} className="text-right text-mining-blue/80">TOTAL</Td>
                  <Td className="text-right text-mining-green">
                    {fmt(detalhamento.reduce((s, d) => s + Number(d.massa || 0), 0), 2)}
                  </Td>
                  <Td className="text-right text-mining-blue">
                    {fmt(detalhamento.reduce((s, d) => s + Number(d.viagens || 0), 0))}
                  </Td>
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </Panel>

        <Panel title="Acompanhamento de Viagens" className="col-span-12 lg:col-span-3">
          {acompViagens.length === 0 ? (
            <Empty />
          ) : (
            <div className="max-h-64 overflow-auto">
            <table className="w-full text-[10px] font-mono">
              <thead className="text-mining-blue/70">
                <tr className="border-b border-mining-blue/20">
                  <Th>CR</Th><Th>Origem</Th><Th>Destino</Th><Th>Material</Th>
                  <Th className="text-right">Qtd</Th>
                  <Th className="text-right">Tonelagem</Th>
                  <Th>Início</Th><Th>Fim</Th>
                  <Th className="text-right">Ciclo</Th>
                </tr>
              </thead>
              <tbody>
                {acompViagens.map((v, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <Td>{String(v.equipamento ?? "—")}</Td>
                    <Td>{String(v.origem ?? "—")}</Td>
                    <Td>{String(v.destino ?? "—")}</Td>
                    <Td>{String(v.material ?? "—")}</Td>
                    <Td className="text-right text-mining-blue">{fmt(v.viagem)}</Td>
                    <Td className="text-right text-mining-green">{fmt(v.massa, 2)}</Td>
                    <Td>{fmtHora(v.event_start)}</Td>
                    <Td>{fmtHora(v.event_end)}</Td>
                    <Td className="text-right">{fmt(v.tempo_ciclo, 2)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-mining-navy/95 border-t border-mining-blue/40">
                <tr className="font-bold">
                  <Td colSpan={4} className="text-right text-mining-blue/80">TOTAL</Td>
                  <Td className="text-right text-mining-blue">
                    {fmt(acompViagens.reduce((s, v) => s + (Number(v.viagem) || 0), 0))}
                  </Td>
                  <Td className="text-right text-mining-green">
                    {fmt(acompViagens.reduce((s, v) => s + Number(v.massa || 0), 0), 2)}
                  </Td>
                  <Td colSpan={3}>{""}</Td>
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </Panel>

      </div>

      {/* API status */}
      {isError && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-mining-red/40 bg-mining-red/10 px-3 py-2 text-[11px] font-mono text-mining-red">
          <AlertTriangle className="h-4 w-4" />
          Sem comunicação com API local
          <span className="text-mining-red/60">
            ({error instanceof Error ? error.message : "erro desconhecido"})
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] font-mono text-mining-blue/70">
        <span className="flex items-center gap-2">
          Fonte: http://192.168.17.15:3001/api/dashboard · auto 60s
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isError ? "bg-mining-red" : "bg-mining-green animate-pulse"}`} />
          <span className={isError ? "text-mining-red" : "text-mining-green"}>
            {isError ? "Desconectado" : "Conectado"}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ---------- small components ---------- */
const tooltipStyle: React.CSSProperties = {
  background: "hsl(220 50% 6%)",
  border: "1px solid hsl(199 95% 60% / 0.4)",
  fontSize: 11,
  color: "hsl(210 40% 96%)",
};

function Kpi({
  label,
  value,
  color,
  borderClass = "border-mining-blue/20",
}: {
  label: string;
  value: string;
  color: string;
  borderClass?: string;
}) {
  return (
    <div className={`bg-[hsl(220_45%_9%/0.85)] border ${borderClass} rounded-md px-3 py-2 flex items-center`}>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-widest text-mining-blue/70 font-bold truncate">{label}</p>
        <p className={`text-lg md:text-xl font-black leading-tight ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function MiniKpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-[hsl(220_45%_9%/0.85)] border border-mining-blue/20 rounded-md p-2 flex flex-col justify-center">
      <p className="text-[8px] uppercase tracking-widest text-mining-blue/70 font-bold leading-tight">{label}</p>
      <p className="text-base font-black text-mining-blue leading-tight">{value}</p>
      {unit && <p className="text-[9px] font-mono text-muted-foreground">{unit}</p>}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left font-bold py-1 pr-2 ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`py-1 pr-2 truncate ${className}`}>{children}</td>;
}
function Empty() {
  return <p className="text-[11px] text-muted-foreground font-mono py-8 text-center">Sem dados reais disponíveis</p>;
}