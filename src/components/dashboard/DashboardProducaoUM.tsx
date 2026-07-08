import { useCallback, useMemo, useState, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
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
import { DASHBOARD_API_URL, type DashboardApiPayload } from "@/hooks/useDashboardApi";

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

const FRENTE_COLORS = [
  "#22d3ee", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#ef4444", // red
  "#8b5cf6", // violet
  "#0ea5e9", // sky
  "#f59e0b", // amber
];

const normEquip = (v: unknown) =>
  String(v ?? "").replace(/[-\s]/g, "").toUpperCase();

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`chart-card dashboard-card bg-[hsl(220_45%_9%/0.85)] border border-mining-blue/20 rounded-md shadow-[0_0_24px_-10px_hsl(var(--mining-blue)/0.55)] hover:shadow-[0_0_28px_-6px_hsl(var(--mining-blue)/0.55)] transition-shadow duration-500 flex flex-col ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between px-3 pt-2">
          <p className="text-[11px] font-bold tracking-wider text-mining-blue uppercase">{title}</p>
          {right}
        </div>
      )}
      <div className="p-3 pt-2 flex-1 min-h-0">{children}</div>
    </motion.div>
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
  const [dashboardData, setDashboardData] = useState<DashboardApiPayload | null>(null);
  const [segundosAtualizacao, setSegundosAtualizacao] = useState(15);
  const [, setLoading] = useState(false);
  const [, setErroApi] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState("");
  const isFetchingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregarDashboard = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setLoading(true);
      const url = `${DASHBOARD_API_URL}?ts=${Date.now()}`;
      console.log("Atualizando dashboard...", url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Erro HTTP " + response.status);
      }

      const apiResponse = (await response.json()) as DashboardApiPayload;
      const k: any = apiResponse?.kpis ?? {};
      const lr: any = (apiResponse as any)?.lavRet ?? {};
      console.log("[DASHBOARD ATUALIZADO]", {
        atualizadoEm: (apiResponse as any)?.atualizadoEm,
        cards: (apiResponse as any)?.cards,
        frentes: apiResponse?.producaoFrente,
        viagensCR: apiResponse?.viagensCR?.length,
        viagensHora: apiResponse?.viagensHora,
      });

      setDashboardData(apiResponse);
      setUltimaAtualizacao(apiResponse.atualizadoEm || new Date().toISOString());
      setSegundosAtualizacao(15);
      setErroApi(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[DASHBOARD ERRO]", error);
      setErroApi(message);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    carregarDashboard();
    intervalRef.current = setInterval(() => {
      carregarDashboard();
    }, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [carregarDashboard]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSegundosAtualizacao((prev) => {
        if (prev <= 1) return 15;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cards superiores — 100% vindos de data.cards (sem cálculo no frontend)
  const cards = ((dashboardData as any)?.cards ?? {}) as Record<string, any>;
  const lavCard = (cards.lav ?? {}) as Record<string, any>;
  const retCard = (cards.ret ?? {}) as Record<string, any>;
  const lavFinal = Number(lavCard.acumuladoDia ?? 0);
  const lavProjetado = Number(lavCard.projetadoDia ?? 0);
  const retFinal = Number(retCard.acumuladoDia ?? 0);
  const retProjetado = Number(retCard.projetadoDia ?? 0);
  const producaoDia = Number(cards.producaoDiaria ?? 0);
  const producaoMensal = Number(cards.producaoMensal ?? 0);
  const producaoTotalEscavadeirasTH = Number(cards.th ?? 0);
  const viagens = Number(cards.viagens ?? 0);

  const dailySeries = useMemo(
    () =>
      (dashboardData?.producaoDiaria ?? []).map((d) => ({
        dia: d.data,
        Real: Number(d.real ?? 0),
        Prevista: Number(d.previsto ?? 0),
      })),
    [dashboardData],
  );

  const frenteAgg = useMemo(() => {
    const arr = (dashboardData?.producaoFrente ?? [])
      .map((f) => ({ name: String(f.frente), value: Number(f.massa ?? 0) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, r) => s + r.value, 0) || 1;
    return arr.map((r) => ({ ...r, pct: (r.value / total) * 100 }));
  }, [dashboardData]);

  // Mostra SEMPRE todas as escavadeiras da whitelist, mesmo com zero.
  const top5Escav = useMemo(() => {
    const rank = Array.isArray(dashboardData?.rankingEscavadeiras) ? dashboardData!.rankingEscavadeiras! : [];
    const byCode = new Map<string, any>();
    rank.forEach((e: any) => {
      const code = normEquip(e.equipamento);
      if (code) byCode.set(code, e);
    });
    const ordem = ["EH4026","EH4039","EH4041","EH4047","EH4050","EH4035","EH5003","EH5004","EH5036"];
    const rows = ordem.map((code) => {
      const e = byCode.get(code) ?? {};
      return {
        equipamento: code,
        th: Number(e.th ?? 0),
        viagens: Number(e.viagens ?? 0),
        massa: Number(e.massa ?? 0),
        material: e.material ?? null,
        frente: e.frente ?? null,
        destino: e.destino ?? null,
      };
    });
    // Operando (com produção) no topo, sem produção no fim
    return rows.sort((a, b) => {
      const aAtiva = a.massa > 0 || a.th > 0 || a.viagens > 0 ? 1 : 0;
      const bAtiva = b.massa > 0 || b.th > 0 || b.viagens > 0 ? 1 : 0;
      if (aAtiva !== bAtiva) return bAtiva - aAtiva;
      return b.th - a.th;
    });
  }, [dashboardData]);
  const totalMassaTop5 = top5Escav.reduce((total, item) => total + Number(item.massa || 0), 0);
  const totalViagensTop5 = top5Escav.reduce((total, item) => total + Number(item.viagens || 0), 0);

  const viagensPorHora = useMemo(() => {
    const base = Array.from({ length: 24 }, (_, h) => ({
      hora: String(h).padStart(2, "0"),
      Real: 0,
    }));
    (dashboardData?.viagensHora ?? []).forEach((v) => {
      const h = Number(String(v.hora).slice(0, 2));
      if (h >= 0 && h < 24) base[h].Real = Number(v.viagens ?? 0);
    });
    return base;
  }, [dashboardData]);

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

  const acompViagens = useMemo(() => {
    const arr = Array.isArray(dashboardData?.viagensCR) ? dashboardData!.viagensCR! : [];
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
  }, [dashboardData]);

  const limparFiltros = () => {
    setDtIni(inicioAno);
    setDtFim(hoje);
  };

  const atualizadoEm = (dashboardData as any)?.atualizadoEm || ultimaAtualizacao;
  const atualizadoEmFormatado = atualizadoEm ? new Date(atualizadoEm).toLocaleString("pt-BR") : "—";

  return (
    <div className="force-live-animation min-h-screen bg-[hsl(220_50%_5%)] text-foreground p-2 md:p-3 font-sans dashboard-enter">
      {/* KPI strip — valores exclusivos de data.kpis */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <LavRetKpi
          label="LAV"
          acumulado={lavFinal}
          projetado={lavProjetado}
          tone="green"
          acumuladoTone="blue"
          projetadoTone="green"
        />
        <LavRetKpi
          label="RET"
          acumulado={retFinal}
          projetado={retProjetado}
          tone="amber"
          acumuladoTone="amber"
          projetadoTone="amber"
        />
        <BigKpi
          label="Produção Mensal"
          value={producaoMensal}
          suffix=" t"
          tone="green"
        />
        <BigKpi
          label="T/H"
          value={producaoTotalEscavadeirasTH}
          suffix=" t/h"
          tone="green"
          showBar
        />
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-12 gap-2 mt-2 items-stretch">
        <Panel title="Produção Diária (t)" className="col-span-12 lg:col-span-4 h-[300px] animated-card">
          {dailySeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="force-live-animation daily-bars h-full chart-bar-grow neon-chart pulse-bar rain-effect">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="dia" stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Prevista" fill="#f59e0b" radius={[2, 2, 0, 0]} animationDuration={900} animationEasing="ease-out" />
                  <Bar dataKey="Real" fill="#22c55e" radius={[2, 2, 0, 0]} animationDuration={900} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Produção por Frente (t)" className="col-span-12 lg:col-span-3 h-[300px] animated-card">
          {frenteAgg.length === 0 ? (
            <Empty />
          ) : (() => {
            const totalFrente = frenteAgg.reduce((s, r) => s + r.value, 0);
            return (
              <div className="force-live-animation front-donut neon-donut h-full flex items-center gap-2">
                <div className="w-[45%] h-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <filter id="frenteNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="4" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <radialGradient id="frenteCenterGlow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="hsl(199 100% 60% / 0.55)" />
                          <stop offset="60%" stopColor="hsl(199 100% 60% / 0.10)" />
                          <stop offset="100%" stopColor="hsl(199 100% 60% / 0)" />
                        </radialGradient>
                      </defs>
                      <Pie
                        data={frenteAgg}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="60%"
                        outerRadius="92%"
                        paddingAngle={2}
                        stroke="hsl(220 50% 6%)"
                        strokeWidth={1.5}
                        filter="url(#frenteNeonGlow)"
                        animationDuration={900}
                        animationEasing="ease-out"
                        isAnimationActive
                      >
                        {frenteAgg.map((_, i) => (
                          <Cell key={i} fill={FRENTE_COLORS[i % FRENTE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number, _n, p: any) => [
                          `${fmt(v)} t (${(p?.payload?.pct ?? 0).toFixed(1)}%)`,
                          p?.payload?.name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div
                    className="chart-center-pulse absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, hsl(199 100% 60% / 0.18) 0%, transparent 60%)" }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[8px] uppercase tracking-[0.2em] text-cyan-300/80 font-bold">Total</span>
                    <span className="text-lg font-black text-cyan-300 font-mono tabular-nums drop-shadow-[0_0_10px_hsl(199_100%_60%/0.9)]">
                      {fmt(totalFrente)}
                    </span>
                    <span className="text-[9px] text-cyan-200/60 font-mono tracking-widest">t</span>
                  </div>
                </div>
                <div className="w-[55%] h-full overflow-auto pr-1 space-y-[3px] text-[10px] font-mono">
                  {frenteAgg.map((f, i) => (
                    <motion.div
                      key={f.name}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="flex items-center gap-1.5"
                    >
                      <span
                        className="w-2 h-2 shrink-0 inline-block rounded-full"
                        style={{
                          background: FRENTE_COLORS[i % FRENTE_COLORS.length],
                          boxShadow: `0 0 6px ${FRENTE_COLORS[i % FRENTE_COLORS.length]}`,
                        }}
                      />
                      <span className="truncate text-foreground flex-1" title={f.name}>
                        {f.name}
                      </span>
                      <span
                        className="tabular-nums shrink-0 font-bold"
                        style={{ color: FRENTE_COLORS[i % FRENTE_COLORS.length] }}
                      >
                        {f.pct.toFixed(1)}%
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })()}
        </Panel>

        <Panel title="ESCAVADEIRAS" className="col-span-12 lg:col-span-5 lg:row-span-2 h-[492px] animated-card">
          {top5Escav.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 min-h-0 overflow-hidden">
                <table className="w-full table-fixed text-[10px] font-mono border-collapse">
                  <colgroup>
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "15%" }} />
                  </colgroup>
                  <thead className="text-mining-blue/70 sticky top-0 bg-[hsl(220_45%_9%)] z-10">
                    <tr className="border-b border-mining-blue/25">
                      <Th>Escavadeira</Th>
                      <Th>Material</Th>
                      <Th>Frente</Th>
                      <Th>Destino</Th>
                      <Th className="text-right">Qtd</Th>
                      <Th className="text-right">Tonelagem</Th>
                      <Th className="text-right">T/H</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5Escav.map((esc, index) => (
                      <motion.tr
                        key={esc.equipamento}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.05 }}
                        className={`border-b border-white/5 hover:bg-white/[0.03] ${
                          esc.massa > 0 || esc.th > 0 || esc.viagens > 0
                            ? "bg-emerald-500/[0.03]"
                            : "opacity-60"
                        }`}
                      >
                        {esc.massa > 0 || esc.th > 0 || esc.viagens > 0 ? (
                          <>
                        <Td>
                          <span className="flex items-center gap-1.5">
                            <span className="w-4 h-4 flex items-center justify-center rounded-sm bg-emerald-400 text-background text-[9px] font-black font-sans shadow-[0_0_8px_hsl(142_71%_45%/0.7)] animate-pulse">
                              {index + 1}
                            </span>
                            <span className="font-black text-emerald-300 text-glow-neon">{esc.equipamento}</span>
                          </span>
                        </Td>
                        <Td>{esc.material ?? "—"}</Td>
                        <Td>{esc.frente ?? "—"}</Td>
                        <Td>{esc.destino ?? "—"}</Td>
                        <Td className="text-right text-mining-blue tabular-nums"><Counter value={esc.viagens} /></Td>
                        <Td className="text-right text-mining-green tabular-nums"><Counter value={esc.massa} /> t</Td>
                        <Td className="text-right text-foreground font-bold tabular-nums"><Counter value={esc.th} decimals={1} /> t/h</Td>
                          </>
                        ) : (
                          <>
                            <Td>
                              <span className="flex items-center gap-1.5">
                                <span className="w-4 h-4 flex items-center justify-center rounded-sm bg-muted text-muted-foreground text-[9px] font-black font-sans">
                                  —
                                </span>
                                <span className="font-black text-muted-foreground">{esc.equipamento}</span>
                              </span>
                            </Td>
                            <Td colSpan={6} className="text-muted-foreground italic text-[10px]">
                              SEM PRODUÇÃO NO DIA
                            </Td>
                          </>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-mining-blue/30 mt-2 pt-2 flex items-center justify-between px-1 text-[11px] font-mono">
                <span className="font-bold uppercase tracking-wider text-foreground">TOTAL</span>
                <div className="flex items-center gap-6">
                  <span className="text-muted-foreground">Viagens: <span className="text-mining-blue font-bold">{fmt(totalViagensTop5)}</span></span>
                  <span className="text-muted-foreground">Tonelagem: <span className="text-mining-green font-bold">{fmt(totalMassaTop5)} t</span></span>
                </div>
              </div>
            </div>
          )}
        </Panel>
        <Panel title="Produtividade (t/h)" className="col-span-12 lg:col-span-4 h-[184px] animated-card">
          {prodSeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="force-live-animation productivity-line h-full chart-line-neon glow-line neon-chart scan-line">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prodSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="dia" stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#7fb2d9" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="Meta" stroke="#f59e0b" dot={false} strokeWidth={2} animationDuration={1200} animationEasing="ease-out" />
                  <Line type="monotone" dataKey="Previsto" stroke="#38bdf8" dot={false} strokeWidth={2} animationDuration={1200} animationEasing="ease-out" />
                  <Line type="monotone" dataKey="Real" stroke="#22c55e" dot={false} strokeWidth={2} animationDuration={1200} animationEasing="ease-out" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Viagens por Hora" className="col-span-12 lg:col-span-2 h-[184px] animated-card">
          {viagensPorHora.every((v) => v.Real === 0) ? (
            <Empty />
          ) : (
            <div className="force-live-animation hourly-trips daily-bars h-full chart-bar-grow neon-chart pulse-bar scan-line">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={viagensPorHora} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="hora" stroke="#7fb2d9" tick={{ fontSize: 8 }} interval={1} />
                  <YAxis stroke="#7fb2d9" tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="Real" fill="#22d3ee" radius={[2, 2, 0, 0]} animationDuration={900} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel className="col-span-12 lg:col-span-1 h-[184px] animated-card">
          <div className="flex flex-col justify-between h-full py-1 gap-2">
            <StatBlock label="Produção (9H/13H)" value={<Counter value={producaoDia} />} unit="t" big />
            <StatBlock label="Próxima Média" value={<Counter value={producaoTotalEscavadeirasTH} />} />
            <StatBlock label="Viagens" value={<Counter value={viagens} />} />
            <StatBlock label="VOI 10.000" value={<Counter value={mediaViagens} />} />
          </div>
        </Panel>

        <Panel title="Acompanhamento de Viagens (CRs)" className="col-span-12 h-[260px] animated-card">
          {acompViagens.length === 0 ? (
            <Empty />
          ) : (() => {
            const parseInicio = (v: any): number => {
              if (!v) return 0;
              const s = String(v);
              const d = new Date(s);
              if (!Number.isNaN(d.getTime())) return d.getTime();
              const m = s.match(/(\d{2}):(\d{2})/);
              if (m) return Number(m[1]) * 60 + Number(m[2]);
              return 0;
            };
            const sorted = [...acompViagens].sort((a, b) => {
              const dt = Number(b.tonelagem || 0) - Number(a.tonelagem || 0);
              if (dt !== 0) return dt;
              return parseInicio(b.inicio) - parseInicio(a.inicio);
            });
            const perCol = 10;
            const top = sorted.slice(0, perCol * 2);
            const cols = [top.slice(0, perCol), top.slice(perCol, perCol * 2)];
            const renderTable = (rows: typeof acompViagens) => (
              <div className="h-full overflow-hidden">
                <table className="w-full table-fixed text-[10px] font-mono">
                  <colgroup>
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "10%" }} />
                  </colgroup>
                  <thead className="text-mining-blue/70 sticky top-0 bg-[hsl(220_45%_9%)]">
                    <tr className="border-b border-mining-blue/20">
                      <Th>CR</Th>
                      <Th>Escavadeira</Th>
                      <Th>Origem</Th>
                      <Th>Destino</Th>
                      <Th>Material</Th>
                      <Th className="text-right">Qtd</Th>
                      <Th className="text-right">Tonelagem</Th>
                      <Th>Início</Th>
                      <Th>Fim</Th>
                      <Th className="text-right">Ciclo (min)</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((v, i) => (
                      <motion.tr
                        key={`${String(v.cr ?? "cr")}-${String(v.inicio ?? "")}-${String(v.fim ?? "")}-${i}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut", delay: Math.min(i * 0.03, 0.6) }}
                        className="border-b border-white/5 hover:bg-white/[0.03]"
                      >
                        <Td>{String(v.cr ?? "—")}</Td>
                        <Td>{String(v.escavadeira ?? "—")}</Td>
                        <Td>{String(v.origem ?? "—")}</Td>
                        <Td>{String(v.destino ?? "—")}</Td>
                        <Td>{String(v.material ?? "—")}</Td>
                        <Td className="text-right text-mining-blue">{fmt(v.quantidade)}</Td>
                        <Td className="text-right text-mining-green">{fmt(v.tonelagem, 2)}</Td>
                        <Td>{fmtHora(v.inicio)}</Td>
                        <Td>{fmtHora(v.fim)}</Td>
                        <Td className="text-right">{fmt(v.ciclo, 2)}</Td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full">
                {renderTable(cols[0])}
                {renderTable(cols[1])}
              </div>
            );
          })()}
        </Panel>

      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] font-mono text-mining-blue/70">
        <span className="flex items-center gap-2">
          Fonte: http://192.168.17.15:3001/api/dashboard
        </span>
        <span className="flex items-center gap-4">
          <span>
            Atualização em: <span className="text-mining-blue font-bold tabular-nums">{segundosAtualizacao}s</span>
          </span>
          <span>
            Última atualização:{" "}
            <span className="text-foreground font-bold">{atualizadoEmFormatado}</span>
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
      border: "border-emerald-400/40",
      text: "text-emerald-400 drop-shadow-[0_0_8px_hsl(150_90%_55%/0.55)]",
      label: "text-emerald-400",
    },
    amber: {
      grad: "from-[hsl(35_85%_25%)] via-[hsl(30_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-amber-400/50",
      text: "text-amber-400 drop-shadow-[0_0_8px_hsl(35_100%_55%/0.55)]",
      label: "text-amber-400",
    },
    teal: {
      grad: "from-[hsl(180_70%_20%)] via-[hsl(190_60%_14%)] to-[hsl(220_45%_9%)]",
      border: "border-teal-400/30",
      text: "text-teal-300",
      label: "text-teal-200/70",
    },
    blue: {
      grad: "from-[hsl(215_80%_25%)] via-[hsl(215_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-sky-400/40",
      text: "text-sky-400 drop-shadow-[0_0_8px_hsl(199_100%_60%/0.55)]",
      label: "text-sky-400",
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
      className={`kpi-pulse-glow relative overflow-hidden rounded-md border ${t.border} bg-gradient-to-br ${t.grad} px-3 py-2.5 shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300`}
    >
      <p className={`font-mono-mining text-[10px] uppercase tracking-[0.18em] font-bold truncate ${t.label}`}>{label}</p>
      <p className={`font-mono-mining text-2xl md:text-[26px] font-black leading-tight ${t.text} tabular-nums`}>
        <Counter value={numeric} decimals={decimals} suffix={suffix} />
      </p>
      <span className={`pointer-events-none absolute left-4 right-4 bottom-0 h-[2px] rounded-full bg-current ${t.text} opacity-70 blur-[1px]`} />
    </motion.div>
  );
}

function DualKpi({
  label,
  sublabel = "Acumulado Dia",
  acumulado,
  tone,
}: {
  label: string;
  sublabel?: string;
  acumulado: number;
  tone: "green" | "amber" | "teal" | "blue" | "cyan" | "indigo";
}) {
  const toneMap: Record<string, { grad: string; border: string; text: string; label: string }> = {
    green: {
      grad: "from-[hsl(150_80%_18%)] via-[hsl(155_70%_14%)] to-[hsl(220_45%_9%)]",
      border: "border-emerald-400/40",
      text: "text-sky-400 drop-shadow-[0_0_8px_hsl(199_100%_60%/0.55)]",
      label: "text-emerald-400",
    },
    amber: {
      grad: "from-[hsl(35_85%_25%)] via-[hsl(30_70%_16%)] to-[hsl(220_45%_9%)]",
      border: "border-amber-400/50",
      text: "text-amber-400 drop-shadow-[0_0_8px_hsl(35_100%_55%/0.55)]",
      label: "text-amber-400",
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
      className={`kpi-pulse-glow relative overflow-hidden rounded-md border ${t.border} bg-gradient-to-br ${t.grad} px-3 py-2.5`}
    >
      <p className={`font-mono-mining text-[10px] uppercase tracking-[0.18em] font-bold truncate ${t.label}`}>{label}</p>
      <div className="mt-1">
        {sublabel && <p className={`font-mono-mining text-[8px] uppercase tracking-widest font-bold ${t.label} opacity-80`}>{sublabel}</p>}
        <p className={`font-mono-mining text-2xl md:text-[26px] font-black leading-tight ${t.text} tabular-nums`}>
          <Counter value={acumulado} />
        </p>
      </div>
      <span className={`pointer-events-none absolute left-4 right-4 bottom-0 h-[2px] rounded-full bg-current ${t.text} opacity-70 blur-[1px]`} />
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

/* ---------- LAV / RET dual line KPI (photo-1 layout) ---------- */
type KpiTone = "green" | "amber" | "blue";
const TONE_TEXT: Record<KpiTone, string> = {
  green: "text-emerald-400 drop-shadow-[0_0_8px_hsl(150_90%_55%/0.6)]",
  amber: "text-amber-400 drop-shadow-[0_0_8px_hsl(35_100%_55%/0.6)]",
  blue: "text-sky-400 drop-shadow-[0_0_8px_hsl(199_100%_60%/0.6)]",
};
const TONE_BORDER: Record<KpiTone, string> = {
  green: "border-emerald-400/45",
  amber: "border-amber-400/50",
  blue: "border-sky-400/45",
};
const TONE_GLOW: Record<KpiTone, string> = {
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  blue: "bg-sky-400",
};

function LavRetKpi({
  label,
  acumulado,
  projetado,
  tone,
  acumuladoTone,
  projetadoTone,
}: {
  label: string;
  acumulado: number;
  projetado: number;
  tone: KpiTone;
  acumuladoTone: KpiTone;
  projetadoTone: KpiTone;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`kpi-pulse-glow relative overflow-hidden rounded-lg border ${TONE_BORDER[tone]} bg-[hsl(220_45%_7%/0.9)] px-4 py-3`}
    >
      <p className={`font-mono-mining text-[13px] font-black tracking-wider ${TONE_TEXT[tone]}`}>{label}</p>
      <div className={`mt-1 h-px w-full ${TONE_GLOW[tone]} opacity-40`} />

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className={`font-mono-mining text-[10px] uppercase tracking-widest font-bold leading-tight ${TONE_TEXT[tone]} opacity-90`}>
          Acumulado<br />Dia:
        </p>
        <p className={`font-mono-mining text-xl md:text-2xl font-black tabular-nums ${TONE_TEXT[acumuladoTone]}`}>
          <Counter value={acumulado} />
        </p>
      </div>

      <div className={`my-2 border-t border-dashed ${TONE_BORDER[tone]} opacity-60`} />

      <div className="flex items-center justify-between gap-2">
        <p className={`font-mono-mining text-[10px] uppercase tracking-widest font-bold leading-tight ${TONE_TEXT[tone]} opacity-90`}>
          Projetado<br />Dia:
        </p>
        <p className={`font-mono-mining text-xl md:text-2xl font-black tabular-nums ${TONE_TEXT[projetadoTone]}`}>
          <Counter value={projetado} />
        </p>
      </div>

      <span className={`pointer-events-none absolute left-6 right-6 bottom-0 h-[2px] rounded-full ${TONE_GLOW[tone]} opacity-70 blur-[1px]`} />
    </motion.div>
  );
}

/* ---------- Big single value KPI (photo-1 mensal / T/H) ---------- */
function BigKpi({
  label,
  value,
  suffix = "",
  tone,
  showBar = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: KpiTone;
  showBar?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`kpi-pulse-glow relative overflow-hidden rounded-lg border ${TONE_BORDER[tone]} bg-[hsl(220_45%_7%/0.9)] px-4 py-3 flex flex-col`}
    >
      <p className={`font-mono-mining text-[13px] font-black tracking-wider ${TONE_TEXT[tone]}`}>{label}</p>
      <div className={`mt-1 h-px w-full ${TONE_GLOW[tone]} opacity-40`} />

      <p className={`mt-3 font-mono-mining text-3xl md:text-4xl font-black leading-none tabular-nums ${TONE_TEXT[tone]}`}>
        <Counter value={value} suffix={suffix} />
      </p>

      {showBar && (
        <div className="mt-3 h-[3px] w-full rounded-full bg-sky-400 shadow-[0_0_10px_hsl(199_100%_60%/0.9)]" />
      )}

      <span className={`pointer-events-none absolute left-6 right-6 bottom-0 h-[2px] rounded-full ${TONE_GLOW[tone]} opacity-70 blur-[1px]`} />
    </motion.div>
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