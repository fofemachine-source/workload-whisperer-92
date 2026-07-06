import { useMemo, useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useCountdown } from "@/hooks/useCountdown";
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
import { useDashboardApi, useProducaoApi, useViagensApi, useTempoCicloApi } from "@/hooks/useDashboardApi";

/* ---------- helpers ---------- */
const fmt = (n: number, d = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

/** Animated count-up number using requestAnimationFrame (memoized). */
const Counter = memo(function Counter({
  value,
  decimals = 0,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const v = useAnimatedCounter(Number.isFinite(value) ? value : 0);
  return <>{fmt(v, decimals)}{suffix}</>;
});

/** Live clock, updates every second. */
const LiveClock = memo(function LiveClock() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return <>{now.toLocaleString("pt-BR")}</>;
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
  const { data: cicloData } = useTempoCicloApi();

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

  const topEscav = useMemo(() => {
    if (!Array.isArray(data?.rankingEscavadeiras) || data.rankingEscavadeiras.length === 0) return [];
    const detalhado = Array.isArray(data?.rankingEscavadeirasDetalhado)
      ? data!.rankingEscavadeirasDetalhado!
      : [];

    return data.rankingEscavadeiras.map((e: any) => {
      const equipamento = String(e.equipamento ?? "").trim();
      const destinos = (detalhado as any[])
        .filter((d) => String(d.equipamento ?? "").trim() === equipamento)
        .map((d) => ({
          destino: String(d.destino ?? "—"),
          viagens: toNum(d.quantidade ?? d.viagens),
          massa: toNum(d.tonelagem ?? d.massa),
        }));

      return {
        equipamento,
        th: Number(e.th ?? 0),
        viagens: Number(e.viagens ?? 0),
        massa: Number(e.massa ?? 0),
        material: e.material,
        frente: e.frente,
        subarea: e.subarea,
        destino: e.destino,
        destinos,
      };
    });
  }, [data]);

  const top5Escav = topEscav;
  const totalTphEscav = top5Escav.reduce((total, item) => total + Number(item.th || 0), 0);
  const totalMassaTop5 = top5Escav.reduce((total, item) => total + Number(item.massa || 0), 0);
  const totalViagensTop5 = top5Escav.reduce((total, item) => total + Number(item.viagens || 0), 0);

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

  const acompViagens = useMemo(() => {
    const arr = Array.isArray(data?.viagensCR) ? data!.viagensCR! : [];
    return arr.map((r: any) => ({
      cr: r.cr ?? r.equipamento ?? null,
      escavadeira: r.escavadeira ?? null,
      origem: r.origem ?? null,
      destino: r.destino ?? null,
      material: r.material ?? null,
      quantidade: toNum(r.quantidade ?? r.viagens) || 1,
      tonelagem: toNum(r.tonelagem ?? r.massa),
      inicio: r.inicio ?? r.event_start ?? null,
      fim: r.fim ?? r.event_end ?? null,
      ciclo: toNum(r.ciclo ?? r.tempo_ciclo),
    }));
  }, [data]);

  const limparFiltros = () => {
    setDtIni(inicioAno);
    setDtFim(hoje);
  };

  const ultima = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const countdown = useCountdown(5, dataUpdatedAt || 0);

  return (
    <div className="min-h-screen bg-[hsl(220_50%_5%)] text-foreground p-2 md:p-3 font-sans">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 items-stretch">
        <Panel className="col-span-12 lg:col-span-4 !p-0">
          <div className="flex items-center gap-3 px-3 py-2 h-[58px]">
            <div className="flex items-center justify-center w-12 h-12 rounded bg-mining-yellow text-background font-black text-base leading-tight text-center">
              USIM
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black tracking-tight text-foreground">
                DASHBOARD DE PRODUÇÃO
              </h1>
              <p className="text-[10px] font-mono tracking-widest text-mining-blue/80">
                Usina Samaritá / Ethanodes / Energia
              </p>
            </div>
          </div>
        </Panel>
        <Panel className="col-span-12 lg:col-span-8 !p-0">
          <div className="flex items-center justify-end gap-4 px-3 py-3 h-full">
            <div className="flex flex-col text-right text-[11px] font-mono text-mining-blue/80 leading-tight">
              <span>
                {countdown > 0 ? (
                  <>Atualização em <span className="text-mining-blue font-bold tabular-nums">{countdown}s</span></>
                ) : (
                  <span className="text-mining-green font-bold animate-pulse">Atualizando...</span>
                )}
              </span>
              <span>
                Última atualização:{" "}
                <span className="text-foreground font-bold"><LiveClock /></span>
              </span>
            </div>
            <motion.button
              onClick={limparFiltros}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1 border border-mining-blue/40 hover:bg-mining-blue/10 px-3 py-1.5 rounded text-[11px] font-bold text-mining-blue uppercase tracking-wider"
            >
              <Filter className="w-3 h-3" /> Limpar Filtros
            </motion.button>
          </div>
        </Panel>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
        <GradientKpi label="Produção Diária (t)" numeric={producaoReal} tone="green" />
        <GradientKpi label="Produção Mês (t)" numeric={acumuladoMes} tone="amber" />
        <GradientKpi label="Produção 12M (t)" numeric={producaoReal + acumuladoMes} tone="green" />
        <GradientKpi label="Meta Diária (t)" numeric={metaDiaria} tone="blue" />
        <GradientKpi label="Produção 12M (t)" numeric={totalPrevisto + acumuladoMes} tone="blue" />
        <GradientKpi label="Produtividade Lab. 6/ Colheita (t/h)" numeric={totalTphEscav} tone="green" suffix=" t/h" decimals={3} />
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-12 gap-2 mt-2 items-stretch">
        <Panel title="Produção Diária (t)" className="col-span-12 lg:col-span-4 h-[300px]">
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

        <Panel title="Produção por Frente (t)" className="col-span-12 lg:col-span-3 h-[300px]">
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

        <Panel title="Top Escavadeiras" className="col-span-12 lg:col-span-5 lg:row-span-2 h-[492px]">
          {top5Escav.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col h-full">
              <div className="grid grid-cols-[1.6rem_1.05fr_1fr_1.15fr_1.1fr_4.4rem_5rem_3rem] gap-x-2 px-2 pb-1 border-b border-mining-blue/25 text-[9px] font-bold text-mining-blue/70">
                <span />
                <span>Biocombustível</span>
                <span>Material</span>
                <span>Ponto de coleta</span>
                <span>Destino</span>
                <span>Safronas</span>
                <span className="text-right">Capacidade</span>
                <span className="text-right">Toneladas</span>
                <span className="text-right">%</span>
              </div>
              <div className="flex-1 min-h-0 overflow-auto divide-y divide-mining-blue/10">
                <AnimatePresence initial={false}>
                {top5Escav.map((e, i) => {
                  const pct = totalMassaTop5 > 0 ? (Number(e.massa || 0) / totalMassaTop5) * 100 : 0;
                  return (
                    <motion.div
                      key={e.equipamento}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="px-2 py-2"
                    >
                      <div className="grid grid-cols-[1.6rem_1.05fr_1fr_1.15fr_1.1fr_4.4rem_5rem_3rem] gap-x-2 items-center text-[10px] font-mono">
                        <span className="w-5 h-5 flex items-center justify-center rounded-sm bg-mining-yellow text-background text-[10px] font-black font-sans">
                          {i + 1}
                        </span>
                        <span className="text-[11px] font-black text-foreground truncate">{e.equipamento}</span>
                        <span className="text-foreground/90 truncate">{e.material ?? "waste"}</span>
                        <span className="text-foreground/90 truncate">{e.frente ?? e.subarea ?? "—"}</span>
                        <span className="text-foreground/90 truncate">{e.destino ?? "—"}</span>
                        <span className="text-foreground/90 truncate">{e.subarea ?? e.frente ?? "—"}</span>
                        <span className="text-right text-foreground"><Counter value={e.th} decimals={1} suffix=" /h" /></span>
                        <span className="text-right text-foreground font-bold"><Counter value={e.massa} /></span>
                        <span className="text-right text-muted-foreground"><Counter value={pct} decimals={1} /></span>
                      </div>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
              <div className="border-t border-mining-blue/30 mt-2 pt-2 flex items-center justify-between px-1 text-[11px] font-mono">
                <span className="font-bold uppercase tracking-wider text-foreground">Total Escavadeiras</span>
                <div className="flex items-center gap-6">
                  <span className="text-muted-foreground">Viagens: <span className="text-mining-blue font-bold">{fmt(totalViagensTop5)}</span></span>
                  <span className="text-muted-foreground">Toneladas: <span className="text-mining-green font-bold">{fmt(totalMassaTop5)} t</span></span>
                </div>
              </div>
            </div>
          )}
        </Panel>
        <Panel title="Produtividade (t/h)" className="col-span-12 lg:col-span-4 h-[184px]">
          {prodSeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-full">
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

        <Panel title="Viagens por Hora" className="col-span-12 lg:col-span-2 h-[184px]">
          {viagensPorHora.every((v) => v.Real === 0) ? (
            <Empty />
          ) : (
            <div className="h-full">
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

        <Panel className="col-span-12 lg:col-span-1 h-[184px]">
          <div className="flex flex-col justify-between h-full py-1 gap-2">
            <StatBlock label="Produção (9H/13H)" value={<Counter value={producaoReal} />} unit="t" big />
            <StatBlock label="Próxima Média" value={<Counter value={tphMedio} />} />
            <StatBlock label="Viagens" value={<Counter value={kpis?.viagens ?? 0} />} />
            <StatBlock label="VOI 10.000" value={<Counter value={mediaViagens} />} />
          </div>
        </Panel>

        <Panel title="Detalhamento de Produção" className="col-span-12 lg:col-span-3 h-[164px]">
          {detalhamento.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-full overflow-auto">
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

        <Panel title="Acompanhamento de Viagens (9H)" className="col-span-12 lg:col-span-5 h-[164px]">
          {acompViagens.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-full overflow-y-auto overflow-x-hidden">
            <table className="w-full table-fixed text-[10px] font-mono">
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
                    <Td>{String(v.cr ?? "—")}</Td>
                    <Td>{String(v.origem ?? "—")}</Td>
                    <Td>{String(v.destino ?? "—")}</Td>
                    <Td>{String(v.material ?? "—")}</Td>
                    <Td className="text-right text-mining-blue">{fmt(v.quantidade)}</Td>
                    <Td className="text-right text-mining-green">{fmt(v.tonelagem, 2)}</Td>
                    <Td>{fmtHora(v.inicio)}</Td>
                    <Td>{fmtHora(v.fim)}</Td>
                    <Td className="text-right">{fmt(v.ciclo, 2)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-mining-navy/95 border-t border-mining-blue/40">
                <tr className="font-bold">
                  <Td colSpan={4} className="text-right text-mining-blue/80">TOTAL</Td>
                  <Td className="text-right text-mining-blue">
                    {fmt(acompViagens.reduce((s, v) => s + (Number(v.quantidade) || 0), 0))}
                  </Td>
                  <Td className="text-right text-mining-green">
                    {fmt(acompViagens.reduce((s, v) => s + Number(v.tonelagem || 0), 0), 2)}
                  </Td>
                  <Td colSpan={3}>{""}</Td>
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </Panel>

        <Panel title="Resumo de Tempos em Ciclo (9H)" className="col-span-12 lg:col-span-4 h-[164px]">
          {(() => {
            const rows = Array.isArray(cicloData) ? cicloData : [];
            if (rows.length === 0) return <Empty />;
            return (
              <div className="h-full overflow-auto">
                <table className="w-full text-[10px] font-mono">
                  <thead className="text-mining-blue/70">
                    <tr className="border-b border-mining-blue/20">
                      <Th>Transporte</Th>
                      <Th className="text-right">Viagens (Qtd)</Th>
                      <Th className="text-right">Tempo Mín</Th>
                      <Th className="text-right">Tempo Máx</Th>
                      <Th className="text-right">Desvio Padrão</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r: any, i: number) => (
                      <tr key={i} className="border-b border-white/5">
                        <Td>{String(pick(r, ["transporte", "categoria", "estado", "sub_estado", "descricao"]) ?? "—")}</Td>
                        <Td className="text-right text-mining-blue">{fmt(toNum(pick(r, ["viagens", "quantidade", "qtd"])))}</Td>
                        <Td className="text-right">{String(pick(r, ["tempo_min", "min", "tempoMin"]) ?? "—")}</Td>
                        <Td className="text-right">{String(pick(r, ["tempo_max", "max", "tempoMax"]) ?? "—")}</Td>
                        <Td className="text-right text-mining-yellow">{String(pick(r, ["desvio_padrao", "desvio", "std"]) ?? "—")}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
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

function GradientKpi({
  label,
  numeric,
  tone,
  suffix = "",
  decimals = 0,
}: {
  label: string;
  numeric: number;
  tone: "green" | "amber" | "teal" | "blue" | "cyan" | "indigo";
  suffix?: string;
  decimals?: number;
}) {
  const toneMap: Record<string, { grad: string; border: string; text: string; label: string }> = {
    green: {
      grad: "from-[hsl(150_80%_18%)] via-[hsl(155_70%_14%)] to-[hsl(220_45%_9%)]",
      border: "border-emerald-400/30",
      text: "text-emerald-300",
      label: "text-emerald-200/70",
    },
    amber: {
      grad: "from-[hsl(35_85%_25%)] via-[hsl(30_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-amber-400/30",
      text: "text-amber-300",
      label: "text-amber-200/70",
    },
    teal: {
      grad: "from-[hsl(180_70%_20%)] via-[hsl(190_60%_14%)] to-[hsl(220_45%_9%)]",
      border: "border-teal-400/30",
      text: "text-teal-300",
      label: "text-teal-200/70",
    },
    blue: {
      grad: "from-[hsl(215_80%_25%)] via-[hsl(215_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-sky-400/30",
      text: "text-sky-300",
      label: "text-sky-200/70",
    },
    cyan: {
      grad: "from-[hsl(190_85%_25%)] via-[hsl(200_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-cyan-400/30",
      text: "text-cyan-300",
      label: "text-cyan-200/70",
    },
    indigo: {
      grad: "from-[hsl(240_60%_25%)] via-[hsl(240_50%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-indigo-400/30",
      text: "text-indigo-300",
      label: "text-indigo-200/70",
    },
  };
  const t = toneMap[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ boxShadow: "0 0 14px rgba(0,180,255,0.15)" }}
      className={`relative overflow-hidden rounded-md border ${t.border} bg-gradient-to-br ${t.grad} px-3 py-2.5 shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300`}
    >
      <p className={`text-[9px] uppercase tracking-[0.18em] font-bold truncate ${t.label}`}>{label}</p>
      <p className={`text-2xl md:text-[26px] font-black leading-tight ${t.text} font-mono tabular-nums`}>
        <Counter value={numeric} decimals={decimals} suffix={suffix} />
      </p>
    </motion.div>
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

function StatBlock({
  label,
  value,
  unit,
  big = false,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  big?: boolean;
}) {
  return (
    <div className="leading-tight">
      <p className="text-[8px] uppercase tracking-widest text-mining-blue/70 font-bold">{label}</p>
      <p className={`${big ? "text-xl" : "text-sm"} font-black text-foreground font-mono tabular-nums`}>
        {value}
      </p>
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