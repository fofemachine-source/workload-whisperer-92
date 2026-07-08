import { useCallback, useMemo, useState, useEffect, memo } from "react";
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

const FRENTE_COLORS = ["#38bdf8", "#22d3ee", "#0ea5e9", "#f59e0b", "#22c55e", "#a855f7", "#ef4444", "#eab308"];

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
      className={`bg-[hsl(220_45%_9%/0.85)] border border-mining-blue/20 rounded-md shadow-[0_0_24px_-10px_hsl(var(--mining-blue)/0.55)] hover:shadow-[0_0_28px_-6px_hsl(var(--mining-blue)/0.55)] transition-shadow duration-500 flex flex-col ${className}`}
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
  const [dataUpdatedAt, setDataUpdatedAt] = useState(0);
  const [segundosAtualizacao, setSegundosAtualizacao] = useState(60);
  const [, setLoading] = useState(false);
  const [, setErroApi] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState("");

  const carregarDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setSegundosAtualizacao(60);
      const url = `${DASHBOARD_API_URL}?ts=${Date.now()}`;
      console.log("Atualizando dashboard...", url);

      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });

      if (!response.ok) {
        throw new Error("Erro HTTP " + response.status);
      }

      const apiResponse = (await response.json()) as DashboardApiPayload;
      console.log("KPIs recebidos:", apiResponse.kpis);
      console.log("CRs recebidos:", Array.isArray((apiResponse as any).viagensCR) ? (apiResponse as any).viagensCR.length : 0);
      console.log("Escavadeiras recebidas:", Array.isArray((apiResponse as any).rankingEscavadeiras) ? (apiResponse as any).rankingEscavadeiras.length : 0);

      setDashboardData(apiResponse);
      setUltimaAtualizacao(apiResponse.atualizadoEm || new Date().toISOString());
      setDataUpdatedAt(Date.now());
      setErroApi(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Erro ao atualizar dashboard:", error);
      setErroApi(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    let intervalo: ReturnType<typeof setInterval>;

    const executar = async () => {
      if (!ativo) return;
      await carregarDashboard();
    };

    executar();
    intervalo = setInterval(() => {
      executar();
    }, 60000);

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [carregarDashboard]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSegundosAtualizacao((prev) => {
        if (prev <= 1) return 60;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Valores direto da API — sem cálculo no frontend
  const kpis = (dashboardData?.kpis ?? {}) as Record<string, any>;
  const producaoDia = Number(kpis.producaoDia ?? 0);
  const producaoMensal = Number(kpis.producaoMensal ?? 0);
  const producaoTotalEscavadeirasTH = Number(kpis.producaoTotalEscavadeirasTH ?? 0);
  const viagens = Number(kpis.viagens ?? 0);

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
    <div className="min-h-screen bg-[hsl(220_50%_5%)] text-foreground p-2 md:p-3 font-sans dashboard-enter">
      {/* KPI strip — valores exclusivos de data.kpis */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <DualKpi key={`dia-${dataUpdatedAt}-${producaoDia}`} label="Produção Diária" sublabel="Hoje" acumulado={producaoDia} tone="green" />
        <DualKpi key={`mes-${dataUpdatedAt}-${producaoMensal}`} label="Produção Mensal" sublabel="" acumulado={producaoMensal} tone="amber" />
        <GradientKpi key={`th-${dataUpdatedAt}-${producaoTotalEscavadeirasTH}`} label="Produção Total das Escavadeiras (t/h)" numeric={producaoTotalEscavadeirasTH} tone="green" suffix=" t/h" decimals={0} />
        <GradientKpi key={`viagens-${dataUpdatedAt}-${viagens}`} label="Viagens" numeric={viagens} tone="blue" decimals={0} />
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-12 gap-2 mt-2 items-stretch">
        <Panel title="Produção Diária (t)" className="col-span-12 lg:col-span-4 h-[300px] animated-card">
          {dailySeries.length === 0 ? (
            <Empty />
          ) : (
            <div key={`daily-${dataUpdatedAt}`} className="h-full chart-bar-grow neon-chart pulse-bar rain-effect">
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
          ) : (
            <div key={`front-${dataUpdatedAt}`} className="h-full flex items-center gap-2">
              <div className="w-[45%] h-full relative chart-pie-spin neon-donut neon-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={frenteAgg}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="90%"
                      paddingAngle={1}
                      stroke="none"
                      animationDuration={900}
                      animationEasing="ease-out"
                    >
                      {frenteAgg.map((_, i) => (
                        <Cell key={i} fill={FRENTE_COLORS[i % FRENTE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, _n, p: any) => [`${fmt(v)} t (${(p?.payload?.pct ?? 0).toFixed(1)}%)`, p?.payload?.name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none chart-center-pulse">
                  <span className="text-[9px] uppercase tracking-widest text-mining-blue/70 font-bold">Total</span>
                  <span className="text-sm font-black text-foreground font-mono tabular-nums">
                    {fmt(frenteAgg.reduce((s, r) => s + r.value, 0))} t
                  </span>
                </div>
              </div>
              <div className="w-[55%] h-full overflow-auto pr-1 space-y-1 text-[10px] font-mono">
                {frenteAgg.map((f, i) => (
                  <div key={`${f.name}-${dataUpdatedAt}`} className="flex items-center gap-1.5 table-row-fade" style={{ animationDelay: `${i * 45}ms` }}>
                    <span
                      className="w-2 h-2 shrink-0 inline-block rounded-sm"
                      style={{ background: FRENTE_COLORS[i % FRENTE_COLORS.length] }}
                    />
                    <span className="truncate text-foreground flex-1" title={f.name}>{f.name}</span>
                    <span className="text-mining-blue tabular-nums shrink-0">{f.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                        key={`${esc.equipamento}-${dataUpdatedAt}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.05 }}
                        className="border-b border-white/5 hover:bg-white/[0.03]"
                      >
                        <Td>
                          <span className="flex items-center gap-1.5">
                            <span className="w-4 h-4 flex items-center justify-center rounded-sm bg-mining-yellow text-background text-[9px] font-black font-sans">
                              {index + 1}
                            </span>
                            <span className="font-black text-foreground">{esc.equipamento}</span>
                          </span>
                        </Td>
                        <Td>{esc.material ?? "—"}</Td>
                        <Td>{esc.frente ?? "—"}</Td>
                        <Td>{esc.destino ?? "—"}</Td>
                        <Td className="text-right text-mining-blue tabular-nums"><Counter value={esc.viagens} /></Td>
                        <Td className="text-right text-mining-green tabular-nums"><Counter value={esc.massa} /> t</Td>
                        <Td className="text-right text-foreground font-bold tabular-nums"><Counter value={esc.th} decimals={1} /> t/h</Td>
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
            <div key={`line-${dataUpdatedAt}`} className="h-full chart-line-neon glow-line neon-chart scan-line">
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
            <div key={`hours-${dataUpdatedAt}`} className="h-full chart-bar-grow neon-chart pulse-bar scan-line">
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
            const sorted = [...acompViagens].sort(
              (a, b) => Number(b.tonelagem || 0) - Number(a.tonelagem || 0),
            );
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
                        key={`${dataUpdatedAt}-${i}`}
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
      className={`kpi-pulse-glow relative overflow-hidden rounded-md border ${t.border} bg-gradient-to-br ${t.grad} px-3 py-2.5 shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300`}
    >
      <p className={`text-[9px] uppercase tracking-[0.18em] font-bold truncate ${t.label}`}>{label}</p>
      <p className={`text-2xl md:text-[26px] font-black leading-tight ${t.text} font-mono tabular-nums`}>
        <Counter value={numeric} decimals={decimals} suffix={suffix} />
      </p>
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
      className={`kpi-pulse-glow relative overflow-hidden rounded-md border ${t.border} bg-gradient-to-br ${t.grad} px-3 py-2.5`}
    >
      <p className={`text-[9px] uppercase tracking-[0.18em] font-bold truncate ${t.label}`}>{label}</p>
      <div className="mt-1">
        {sublabel && <p className={`text-[8px] uppercase tracking-widest font-bold ${t.label}`}>{sublabel}</p>}
        <p className={`text-2xl md:text-[26px] font-black leading-tight ${t.text} font-mono tabular-nums`}>
          <Counter value={acumulado} />
        </p>
      </div>
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