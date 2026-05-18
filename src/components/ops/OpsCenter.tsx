import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { Calendar, RefreshCw } from "lucide-react";
import { useExcelLive } from "@/context/ExcelLiveContext";
import { FLEET_SIZE, FLEET_TOTAL } from "@/services/excelParser";
import { ExcelUploadButton } from "@/components/dashboard/ExcelUploadButton";
import { MicrosoftLoginButton } from "@/components/microsoft/MicrosoftLoginButton";
import { Button } from "@/components/ui/button";
import { AnimatedTruck } from "./AnimatedTruck";
import logoUM from "@/assets/logo-um.png";
import { AnimatedExcavator } from "./AnimatedExcavator";
import { supportsDateTimeFormatParts } from "@/lib/browserSupport";

const NEON = "#22c55e";
const NEON_DIM = "#15803d";
const BLUE = "#0EA5E9";
const YELLOW = "#FACC15";

const fmt = (n: number, d = 0) =>
  (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function CardShell({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative bg-black/70 border border-mining-green/25 rounded-md overflow-hidden shadow-[0_0_24px_-12px_hsl(var(--mining-green)/0.6)] ${className}`}
    >
      <div className="px-3 py-2 border-b border-mining-green/20 bg-mining-green/5">
        <p className="text-base font-mono font-bold tracking-[0.18em] text-mining-green uppercase">{title}</p>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function ProgressBar({ value, color = NEON }: { value: number; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ background: color, boxShadow: `0 0 12px ${color}` }}
      />
    </div>
  );
}

function Donut({ value, color = NEON, label }: { value: number; color?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c - (c * v) / 100;
  return (
    <div className="relative h-14 w-14 flex items-center justify-center">
      <svg viewBox="0 0 60 60" className="absolute inset-0 -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <motion.circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <span className="text-[13px] font-mono font-bold" style={{ color }}>
        {v.toFixed(1)}%
      </span>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

function FleetRow({
  icon,
  name,
  count,
  total,
  value,
  meta,
  color = NEON,
  iconColor = YELLOW,
}: {
  icon: "ex" | "truck";
  name: string;
  count: number;
  total: number;
  value: number;
  meta: number;
  color?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-16 shrink-0">
        {icon === "ex" ? (
          <AnimatedExcavator className="w-16 h-10" color={iconColor} />
        ) : (
          <AnimatedTruck className="w-16 h-9" color={iconColor} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-mono font-bold text-foreground truncate">{name}</p>
        <p className="text-base font-mono text-muted-foreground">
          ({count}/{total})
        </p>
      </div>
      <Donut value={value} color={color} />
      <div className="text-right w-24 shrink-0">
        <p className="text-lg font-mono text-muted-foreground uppercase">Meta</p>
        <p className="text-2xl font-mono font-bold text-foreground whitespace-nowrap">{meta.toFixed(1)}%</p>
      </div>
    </div>
  );
}

export function OpsCenter() {
  const {
    summary,
    rows,
    fleets: fleetsAgg,
    areas,
    lastUpdated,
    source,
    refresh,
    refreshWorkbook,
    metricsLoading,
    workbookLoading,
    file,
    worksheets,
    workbookError,
    metricsError,
    localFile,
    lastCloudUpload,
  } = useExcelLive();
  const clock = useClock();
  const syncing = metricsLoading || workbookLoading;
  const syncError = workbookError || metricsError;
  const operationNow = useMemo(() => {
    if (!supportsDateTimeFormatParts()) {
      const localNow = new Date(clock.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      return {
        todayKey: `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, "0")}-${String(localNow.getDate()).padStart(2, "0")}`,
        currentHour: localNow.getHours(),
      };
    }
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(clock);
    const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
    return {
      todayKey: `${get("year")}-${get("month")}-${get("day")}`,
      currentHour: Number(get("hour")),
    };
  }, [clock]);
  const todayKey = operationNow.todayKey;
  // Detecta se a planilha ativa não é de hoje. Prioriza a célula DATA: da aba
  // PRODUÇÃO EH (verdade da operação); cai pra parsedAt se a célula não existir.
  const planilhaDesatualizada = useMemo(() => {
    if (summary?.dataPlanilha) return summary.dataPlanilha !== todayKey;
    const today = new Date();
    if (!lastUpdated) return false;
    return (
      lastUpdated.getFullYear() !== today.getFullYear() ||
      lastUpdated.getMonth() !== today.getMonth() ||
      lastUpdated.getDate() !== today.getDate()
    );
  }, [summary?.dataPlanilha, lastUpdated, clock]);
  const dataPlanilhaLabel = useMemo(() => {
    if (summary?.dataPlanilha) {
      const [y, m, d] = summary.dataPlanilha.split("-");
      return `${d}/${m}/${y}`;
    }
    return lastUpdated?.toLocaleDateString("pt-BR") ?? "—";
  }, [summary?.dataPlanilha, lastUpdated]);
  const syncStatus: "error" | "syncing" | "connected" | "idle" = syncError
    ? "error"
    : syncing
      ? "syncing"
      : source === "onedrive"
        ? "connected"
        : "idle";
  const syncStatusMeta = {
    connected: { label: "ONEDRIVE CONECTADO", box: "border-mining-green/40 text-mining-green", dot: "bg-mining-green" },
    syncing: { label: "ATUALIZANDO…", box: "border-mining-yellow/40 text-mining-yellow", dot: "bg-mining-yellow" },
    error: { label: "ERRO DE SINCRONIZAÇÃO", box: "border-mining-red/40 text-mining-red", dot: "bg-mining-red" },
    idle: {
      label: "AGUARDANDO ONEDRIVE",
      box: "border-muted-foreground/30 text-muted-foreground",
      dot: "bg-muted-foreground",
    },
  }[syncStatus];
  const metasFixas = {
    mensal: 1_351_130,
    diaria: 43_584,
    horaria: 1_816,
  };
  const recomputeProjectedForToday = useCallback(
    (acumulado: number, fallback: number) => {
      if (fallback > 0) return fallback;
      return acumulado;
    },
    [],
  );
  const projectedMinaShown = recomputeProjectedForToday(summary?.acumuladoDia || 0, summary?.projetadoDia || 0);
  const handleManualRefresh = async () => {
    await refreshWorkbook();
    await refresh();
  };

  const acumuladoRetaludShown = summary?.acumuladoRetalud || 0;
  const projetoRetaludBase = summary?.projetadoRetalud || acumuladoRetaludShown;
  const projetadoRetaludShown = recomputeProjectedForToday(acumuladoRetaludShown, projetoRetaludBase);
  const baseMetaMina = areas?.Mina?.meta || projectedMinaShown || 0;
  const baseMetaRetalud = areas?.Retaludamento?.meta || projetadoRetaludShown || 0;
  void baseMetaMina;
  void baseMetaRetalud;
  // Metas mensais operacionais (mai/2026).
  const metaMensalMina = 1_351_130;
  const metaMensalRetalud = 1_241_297;
  const metaMensalTotal = metaMensalMina + metaMensalRetalud;
  const shareMetaMina = metaMensalTotal > 0 ? (metaMensalMina / metaMensalTotal) * 100 : 0;
  const shareMetaRetalud = metaMensalTotal > 0 ? (metaMensalRetalud / metaMensalTotal) * 100 : 0;

  // Auto refresh OneDrive a cada 30s
  useEffect(() => {
    if (source !== "onedrive") return;

    const atualizarAutomatico = async () => {
      try {
        await refreshWorkbook();
        await refresh();

        console.log("[AUTO REFRESH OK]", new Date().toLocaleTimeString());
      } catch (err) {
        console.error("[AUTO REFRESH ERROR]", err);
      }
    };

    // executa imediatamente
    atualizarAutomatico();

    // executa continuamente
    const interval = setInterval(() => {
      atualizarAutomatico();
    }, 30000);

    return () => clearInterval(interval);
  }, [source, refresh, refreshWorkbook]);

  const producaoTurno = summary?.acumuladoDia || 0;

  const metaTurno = metasFixas.diaria;

  const aderTurno = metaTurno > 0 ? (producaoTurno / metaTurno) * 100 : 0;

  // PRODUCAO MENSAL REAL DA PLANILHA
  const producaoMensal = summary?.totalRealizado || 0;

  const META_MINA_FALLBACK = 1_351_130;
  const META_RETALUD_FALLBACK = 1_241_297;
  const metaMensal =
    (areas?.Mina?.meta ?? META_MINA_FALLBACK) +
    (areas?.Retaludamento?.meta ?? META_RETALUD_FALLBACK);

  const aderMensal = metaMensal > 0 ? (producaoMensal / metaMensal) * 100 : 0;

  const tonH = summary?.toneladaPorHora || 10_250;
  const metaTonH = 11_500;

  const opEscav = summary?.totalEscavadeiras || 8;
  const opCam = summary?.totalCaminhoes || 35;
  const opTotal = opEscav + opCam;
  const pctOp = (opTotal / FLEET_TOTAL) * 100;

  // Series simuladas/derivadas para os gráficos
  const productionSeries = useMemo(() => {
    const hours = Array.from({ length: 13 }, (_, i) => i * 2);
    let acc = 0;
    const stepReal = producaoTurno / 12;
    const stepMeta = metaTurno / 12;
    const prodHD785 = fleetsAgg?.["Komatsu 785"]?.totalProducao || producaoTurno * 0.55;
    const stepHD785 = prodHD785 / 12;
    return hours.map((h, i) => {
      acc += stepReal;
      return {
        hora: `${String(h).padStart(2, "0")}:00`,
        realizado: i === 0 ? 0 : Math.round(acc),
        meta: Math.round(stepMeta * i),
        hd785: Math.round(stepHD785 * i),
      };
    });
  }, [producaoTurno, metaTurno, fleetsAgg]);

  const tonHSeries = useMemo(() => {
    const real = summary?.hourlySeries;
    // Meta hora-a-hora = projetado / 24 (fallback metaTonH)
    const projetado = projectedMinaShown || 0;
    const metaHora = projetado > 0 ? projetado / 24 : metaTonH;
    if (real && real.length) {
      return real.map((p) => ({
        hora: p.hora,
        tonH: Math.round(p.tonH),
        meta: Math.round(metaHora),
      }));
    }
    // Fallback: 24h vazias (sem dados)
    return Array.from({ length: 24 }, (_, h) => ({
      hora: `${String(h).padStart(2, "0")}:00`,
      tonH: 0,
      meta: Math.round(metaHora),
    }));
  }, [summary, metaTonH, projectedMinaShown]);

  const tonHCheck = useMemo(() => {
    const real = summary?.hourlySeries;
    if (!real || !real.length) return null;
    const soma = real.reduce((a, p) => a + (p.tonH || 0), 0);
    const total = summary?.acumuladoDia || 0;
    if (!total) return null;
    const diff = soma - total;
    const pct = (Math.abs(diff) / total) * 100;
    return { soma: Math.round(soma), total: Math.round(total), diff: Math.round(diff), pct, ok: pct < 1 };
  }, [summary]);

  const ranking = useMemo(() => {
    // 1) Preferir ranking calculado direto da aba PRODUÇÃO EH (fonte oficial).
    const eh = summary?.ehRanking ?? [];
    if (eh.length >= 1) {
      return eh.slice(0, 8).map((r, i) => ({ pos: i + 1, name: r.equipamento, value: r.tph }));
    }
    const all = (rows || []).filter((r) => r.category === "escavadeira" && r.produtividade > 0);
    // Preferir dados da aba "PORTAL Novo" quando disponível
    const portal = all.filter((r) => /portal/i.test(r.source || ""));
    const escav = portal.length >= 4 ? portal : all;
    if (escav.length >= 4) {
      return escav
        .sort((a, b) => b.produtividade - a.produtividade)
        .slice(0, 8)
        .map((r, i) => ({ pos: i + 1, name: r.equipamento, value: r.produtividade }));
    }
    return [
      { pos: 1, name: "EX2500-01", value: 7150 },
      { pos: 2, name: "EX2500-02", value: 6420 },
      { pos: 3, name: "EX1200-02", value: 5180 },
      { pos: 4, name: "EX1200-03", value: 4750 },
      { pos: 5, name: "EX1200-01", value: 4320 },
      { pos: 6, name: "EX1200-04", value: 4180 },
      { pos: 7, name: "EX1200-05", value: 3980 },
      { pos: 8, name: "EX2500-03", value: 3760 },
    ];
  }, [rows, summary]);

  // Frotas (DF/UT/produção por modelo) — vindas da planilha quando disponível
  const fleets = [
    {
      key: "EX1200" as const,
      name: "EX1200",
      icon: "ex" as const,
      count: FLEET_SIZE.EX1200,
      df: fleetsAgg?.EX1200.df ?? 87.2,
      ut: fleetsAgg?.EX1200.ut ?? 79.2,
    },
    {
      key: "EX2500" as const,
      name: "EX2500",
      icon: "ex" as const,
      count: FLEET_SIZE.EX2500,
      df: fleetsAgg?.EX2500.df ?? 88.1,
      ut: fleetsAgg?.EX2500.ut ?? 76.5,
    },
    {
      key: "Komatsu 785" as const,
      name: "CAMINHÕES 785",
      icon: "truck" as const,
      count: FLEET_SIZE["Komatsu 785"],
      df: fleetsAgg?.["Komatsu 785"].df ?? 88.4,
      ut: fleetsAgg?.["Komatsu 785"].ut ?? 76.8,
    },
    {
      key: "Komatsu 730" as const,
      name: "CAMINHÕES 730",
      icon: "truck" as const,
      count: FLEET_SIZE["Komatsu 730"],
      df: fleetsAgg?.["Komatsu 730"].df ?? 86.9,
      ut: fleetsAgg?.["Komatsu 730"].ut ?? 79.5,
    },
  ];

  return (
    <div className="min-h-screen bg-black text-foreground relative overflow-hidden">
      {/* fundo HUD */}
      <div className="absolute inset-0 pointer-events-none ops-grid-bg opacity-30" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(800px_400px_at_20%_0%,hsl(var(--mining-green)/0.12),transparent),radial-gradient(700px_400px_at_80%_100%,hsl(var(--mining-blue)/0.10),transparent)]" />

      {/* TOP BAR */}
      <header className="relative z-10 flex items-center justify-between px-3 py-0.5 border-b border-mining-green/20 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img src={logoUM} alt="Logo U&M" className="h-5 w-auto object-contain" />
        </div>
        <h1 className="text-[11px] md:text-xs font-bold tracking-[0.2em] text-foreground text-glow-neon">
          PAINEL DE PRODUÇÃO OPERACIONAL
        </h1>
        <div className="flex items-center gap-2 text-[9px] font-mono leading-tight flex-wrap justify-end">
          <div className="flex items-center gap-1.5 text-foreground">
            <Calendar className="h-3 w-3 text-mining-green" />
            <div>
              <p>{clock.toLocaleDateString("pt-BR")}</p>
              <p className="text-mining-green">{clock.toLocaleTimeString("pt-BR")}</p>
            </div>
          </div>
          <div className="border-l border-mining-green/20 pl-2">
            <p className="text-muted-foreground">TURNO ATUAL</p>
            <p className="text-mining-green font-bold">DIA</p>
          </div>
          <div className="border-l border-mining-green/20 pl-2 flex items-center gap-1.5">
            <RefreshCw
              className={`h-3 w-3 text-mining-green ${syncing ? "animate-spin" : ""}`}
              style={syncing ? undefined : { animationDuration: "4s" }}
            />
            <div>
              <p className="text-muted-foreground">ÚLTIMO REFRESH</p>
              <p className="text-mining-green">{lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR") : "—"}</p>
              {source === "onedrive" && file && (
                <p className="text-[8px] text-muted-foreground truncate max-w-[140px]">
                  {file.name} · {worksheets.length} aba(s)
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={syncing}
            className="gap-1.5 border-mining-green/40 text-mining-green hover:bg-mining-green/10 h-6 px-2 text-[10px]"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            Atualizar agora
          </Button>
          <MicrosoftLoginButton />
          <ExcelUploadButton />
        </div>
      </header>

      <main className="relative z-10 p-3 md:p-4 grid grid-cols-12 gap-3">
        {/* LINHA 1: 4 cards principais */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 flex">
          <CardShell title="MINA" className="flex-1 flex flex-col">
            <div className="space-y-2 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-mono text-muted-foreground uppercase tracking-wider">ACUMULADO DIA:</span>
                <span className="text-2xl font-mono font-bold text-mining-blue">
                  {fmt(summary?.acumuladoDia || producaoTurno)}
                </span>
              </div>
              <div className="h-px bg-mining-green/15" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-mono text-muted-foreground uppercase tracking-wider">PROJETADO DIA:</span>
                <span className="text-2xl font-mono font-bold text-mining-green text-glow-neon">
                  {fmt(projectedMinaShown || summary?.acumuladoDia || producaoTurno)}
                </span>
              </div>
            </div>
          </CardShell>
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3 flex">
          <CardShell title="RETALUDAMENTO" className="flex-1 flex flex-col">
            <div className="space-y-2 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-mono text-muted-foreground uppercase tracking-wider">ACUMULADO DIA:</span>
                <span className="text-2xl font-mono font-bold text-mining-blue">{fmt(acumuladoRetaludShown)}</span>
              </div>
              <div className="h-px bg-mining-green/15" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-mono text-muted-foreground uppercase tracking-wider">PROJETADO DIA:</span>
                <span className="text-2xl font-mono font-bold text-mining-green text-glow-neon">
                  {fmt(projetadoRetaludShown)}
                </span>
              </div>
            </div>
          </CardShell>
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3 flex">
          <CardShell title="PRODUÇÃO MENSAL" className="flex-1 flex flex-col">
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-end justify-between">
                <p className="text-2xl font-mono font-bold text-mining-green text-glow-neon">
                  {fmt(producaoMensal)} <span className="text-xl">t</span>
                </p>
                <p className="text-2xl font-mono font-bold text-foreground">{aderMensal.toFixed(1)}%</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-lg font-mono text-muted-foreground">
                <span>META: {fmt(metaMensal)} t</span>
                <span>DA META</span>
              </div>
              <div className="mt-1.5">
                <ProgressBar value={aderMensal} />
              </div>
            </div>
          </CardShell>
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3 flex">
          <CardShell title="T/H" className="flex-1 flex flex-col">
            <div className="flex-1 flex flex-col justify-center">
              <p className="text-2xl font-mono font-bold text-mining-green text-glow-neon">
                {fmt(tonH)} <span className="text-xl">t/h</span>
              </p>
              <div className="mt-3 text-lg font-mono text-muted-foreground">META: {fmt(metaTonH)} t/h</div>
              <div className="mt-1.5">
                <ProgressBar value={(tonH / metaTonH) * 100} color={BLUE} />
              </div>
            </div>
          </CardShell>
        </div>

        {/* LINHA 2: META TOTAL MAIO + TONELADAS POR HORA */}
        <div className="col-span-12 lg:col-span-6 flex">
          <CardShell title="META MENSAL" className="flex-1 flex flex-col">
            <div className="grid gap-6 grid-cols-2 min-h-[132px] flex-1">
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-lg font-mono uppercase tracking-[0.18em] text-muted-foreground">Mina</p>
                  <p className="mt-3 text-4xl font-mono font-bold text-mining-yellow">{fmt(metaMensalMina)}</p>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    {shareMetaMina.toFixed(1)}% da meta
                  </p>
                  <div className="mt-2">
                    <ProgressBar value={shareMetaMina} color={YELLOW} />
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-lg font-mono uppercase tracking-[0.18em] text-muted-foreground">Retaludamento</p>
                  <p className="mt-3 text-4xl font-mono font-bold text-mining-yellow">{fmt(metaMensalRetalud)}</p>
                </div>
                <div className="mt-3">
                  <p className="text-xl font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    {shareMetaRetalud.toFixed(1)}% da meta
                  </p>
                  <div className="mt-2">
                    <ProgressBar value={shareMetaRetalud} color={YELLOW} />
                  </div>
                </div>
              </div>
            </div>
          </CardShell>
        </div>
        <div className="col-span-12 lg:col-span-6 flex">
          <CardShell title="TONELADAS POR HORA" className="flex-1 flex flex-col">
            <div className="flex-1 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={tonHSeries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(34,197,94,0.08)" />
                  <XAxis dataKey="hora" stroke="#4ade80" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <YAxis stroke="#4ade80" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <Tooltip
                    contentStyle={{
                      background: "#000",
                      border: `1px solid ${NEON}`,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                    labelStyle={{ color: NEON }}
                  />
                  <Bar dataKey="tonH" fill={NEON} radius={[2, 2, 0, 0]} name="Ton/h" />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    stroke={YELLOW}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    name="Meta"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardShell>
        </div>

        {/* COLUNA ESQUERDA: DF/UT + ESCAVADEIRAS + CAMINHÕES + EQUIP OPERANDO */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
            <CardShell title="% DISPONIBILIDADE FÍSICA POR FROTA" className="h-full">
              {fleets.map((f) => (
                <FleetRow
                  key={`df-${f.name}`}
                  icon={f.icon}
                  name={f.name}
                  count={f.count}
                  total={f.count}
                  value={f.df}
                  meta={85}
                />
              ))}
            </CardShell>
            <CardShell title="UTILIZAÇÃO POR FROTA" className="h-full">
              {fleets.map((f) => (
                <FleetRow
                  key={`ut-${f.name}`}
                  icon={f.icon}
                  name={f.name}
                  count={f.count}
                  total={f.count}
                  value={f.ut}
                  meta={85}
                  color={BLUE}
                />
              ))}
            </CardShell>
          </div>
        </div>

        {/* COLUNA DIREITA: RANKING + TONELADAS/H + PRODUÇÃO TURNO + OPERAÇÃO AO VIVO */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-3">
          <CardShell title="D/F T/H">
            <div className="space-y-1.5">
              {ranking.map((r) => {
                const max = ranking[0]?.value || 1;
                const pct = (r.value / max) * 100;
                return (
                  <div key={r.pos} className="flex items-center gap-2">
                    <span className="w-6 text-base font-mono text-muted-foreground text-right">{r.pos}</span>
                    <span className="w-24 text-base font-mono text-foreground">{r.name}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-mining-green"
                        style={{ width: `${pct}%`, boxShadow: `0 0 8px ${NEON}` }}
                      />
                    </div>
                    <span className="w-24 text-right text-base font-mono text-mining-green">{fmt(r.value)} t/h</span>
                  </div>
                );
              })}
            </div>
          </CardShell>

          <CardShell title="PRODUÇÃO DO TURNO (TONELADAS)">
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productionSeries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="prodFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NEON} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={NEON} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(34,197,94,0.08)" />
                  <XAxis dataKey="hora" stroke="#4ade80" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <YAxis stroke="#4ade80" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <Tooltip
                    contentStyle={{
                      background: "#000",
                      border: `1px solid ${NEON}`,
                      fontFamily: "monospace",
                      fontSize: 11,
                    }}
                    labelStyle={{ color: NEON }}
                  />
                  <Area
                    type="monotone"
                    dataKey="realizado"
                    stroke={NEON}
                    strokeWidth={2}
                    fill="url(#prodFill)"
                    name="Realizado"
                  />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    stroke="#9ca3af"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    name="Meta"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardShell>
        </div>

        {/* FAIXA DE CAMINHÕES ANIMADA — banda inferior */}
        <div className="col-span-12 relative h-14 border border-mining-green/15 rounded-md bg-black/60 overflow-hidden">
          <div className="absolute inset-x-0 bottom-2 h-px bg-gradient-to-r from-transparent via-mining-green/40 to-transparent" />
          <div className="absolute inset-y-0 w-24 animate-truck-drive">
            <AnimatedTruck className="w-24 h-14 mt-0.5" color={YELLOW} />
          </div>
          <div
            className="absolute inset-y-0 w-24 animate-truck-drive"
            style={{ animationDuration: "24s", animationDelay: "-7s" }}
          >
            <AnimatedTruck className="w-24 h-14 mt-0.5" color="#fb923c" />
          </div>
          <div
            className="absolute inset-y-0 w-24 animate-truck-drive"
            style={{ animationDuration: "30s", animationDelay: "-14s" }}
          >
            <AnimatedTruck className="w-24 h-14 mt-0.5" color={NEON} />
          </div>
        </div>

        {/* LOGO U&M */}
        <div className="col-span-12 flex justify-center py-4">
          <img src={logoUM} alt="Logo U&M" className="h-16 object-contain opacity-90" />
        </div>
      </main>
    </div>
  );
}
