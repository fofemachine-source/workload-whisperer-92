import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Cell,
} from "recharts";
import {
  Activity,
  Calendar,
  RefreshCw,
  Shield,
  Settings,
  DollarSign,
  Leaf,
  Mountain,
} from "lucide-react";
import { useExcelLive } from "@/context/ExcelLiveContext";
import { FLEET_SIZE, FLEET_TOTAL } from "@/services/excelParser";
import { ExcelUploadButton } from "@/components/dashboard/ExcelUploadButton";
import { MicrosoftLoginButton } from "@/components/microsoft/MicrosoftLoginButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { AnimatedTruck } from "./AnimatedTruck";
import { AnimatedExcavator } from "./AnimatedExcavator";

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
      <div className="px-3 py-1.5 border-b border-mining-green/20 bg-mining-green/5">
        <p className="text-[10px] font-mono font-bold tracking-[0.18em] text-mining-green uppercase">
          {title}
        </p>
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
      <span className="text-[11px] font-mono font-bold" style={{ color }}>
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
        <p className="text-[11px] font-mono font-bold text-foreground truncate">{name}</p>
        <p className="text-[9px] font-mono text-muted-foreground">
          ({count}/{total})
        </p>
      </div>
      <Donut value={value} color={color} />
      <div className="text-right w-14">
        <p className="text-[8px] font-mono text-muted-foreground uppercase">Meta</p>
        <p className="text-[10px] font-mono text-foreground">{meta.toFixed(1)}%</p>
      </div>
    </div>
  );
}

export function OpsCenter() {
  const { summary, rows, fleets: fleetsAgg, lastUpdated, source, refresh, refreshWorkbook, metricsLoading, workbookLoading, file, worksheets } = useExcelLive();
  const clock = useClock();
  const syncing = metricsLoading || workbookLoading;
  const handleManualRefresh = async () => {
    await Promise.all([refreshWorkbook(), refresh()]);
  };

  // Override manual de RETALUDAMENTO (persistido localmente).
  // Enquanto a leitura automática da planilha não bate, o usuário lança aqui.
  const RETALUD_KEY = "lovable.retalud.override.v1";
  const [retaludOverride, setRetaludOverride] = useState<{ acumulado: number; projetado: number } | null>(() => {
    try {
      const raw = localStorage.getItem(RETALUD_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [retaludOpen, setRetaludOpen] = useState(false);
  const [retaludForm, setRetaludForm] = useState({ acumulado: "", projetado: "" });
  useEffect(() => {
    if (retaludOpen) {
      setRetaludForm({
        acumulado: retaludOverride?.acumulado?.toString() ?? "",
        projetado: retaludOverride?.projetado?.toString() ?? "",
      });
    }
  }, [retaludOpen, retaludOverride]);
  const saveRetalud = () => {
    const a = Number(retaludForm.acumulado.replace(",", ".")) || 0;
    const p = Number(retaludForm.projetado.replace(",", ".")) || a;
    const next = { acumulado: a, projetado: p };
    setRetaludOverride(next);
    localStorage.setItem(RETALUD_KEY, JSON.stringify(next));
    setRetaludOpen(false);
  };
  const clearRetalud = () => {
    localStorage.removeItem(RETALUD_KEY);
    setRetaludOverride(null);
    setRetaludOpen(false);
  };
  const acumuladoRetaludShown = retaludOverride?.acumulado ?? summary?.acumuladoRetalud ?? 0;
  const projetadoRetaludShown = retaludOverride?.projetado ?? summary?.projetadoRetalud ?? summary?.acumuladoRetalud ?? 0;

  // Auto refresh OneDrive a cada 60s
  useEffect(() => {
    if (source !== "onedrive") return;
    const t = setInterval(() => refresh(), 60_000);
    return () => clearInterval(t);
  }, [source, refresh]);

  const producaoTurno = summary?.totalProducao || 128_450;
  const metaTurno = summary?.totalMeta || 150_000;
  const aderTurno = metaTurno > 0 ? (producaoTurno / metaTurno) * 100 : 0;

  const producaoMensal = producaoTurno * 22;
  const metaMensal = metaTurno * 22;
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
    return hours.map((h, i) => {
      acc += stepReal;
      return {
        hora: `${String(h).padStart(2, "0")}:00`,
        realizado: i === 0 ? 0 : Math.round(acc),
        meta: Math.round(stepMeta * i),
      };
    });
  }, [producaoTurno, metaTurno]);

  const tonHSeries = useMemo(() => {
    const hours = Array.from({ length: 13 }, (_, i) => i * 2);
    return hours.map((h) => ({
      hora: `${String(h).padStart(2, "0")}:00`,
      tonH: Math.round(tonH * (0.8 + Math.random() * 0.35)),
      meta: metaTonH,
    }));
  }, [tonH]);

  const ranking = useMemo(() => {
    const escav = (rows || []).filter((r) => r.category === "escavadeira" && r.produtividade > 0);
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
  }, [rows]);

  // Frotas (DF/UT/produção por modelo) — vindas da planilha quando disponível
  const fleets = [
    { key: "EX1200" as const, name: "EX1200", icon: "ex" as const, count: FLEET_SIZE.EX1200, df: fleetsAgg?.EX1200.df ?? 87.2, ut: fleetsAgg?.EX1200.ut ?? 79.2 },
    { key: "EX2500" as const, name: "EX2500", icon: "ex" as const, count: FLEET_SIZE.EX2500, df: fleetsAgg?.EX2500.df ?? 88.1, ut: fleetsAgg?.EX2500.ut ?? 76.5 },
    { key: "Komatsu 785" as const, name: "CAMINHÕES 785", icon: "truck" as const, count: FLEET_SIZE["Komatsu 785"], df: fleetsAgg?.["Komatsu 785"].df ?? 88.4, ut: fleetsAgg?.["Komatsu 785"].ut ?? 76.8 },
    { key: "Komatsu 730" as const, name: "CAMINHÕES 730", icon: "truck" as const, count: FLEET_SIZE["Komatsu 730"], df: fleetsAgg?.["Komatsu 730"].df ?? 86.9, ut: fleetsAgg?.["Komatsu 730"].ut ?? 79.5 },
  ];

  return (
    <div className="min-h-screen bg-black text-foreground relative overflow-hidden">
      {/* fundo HUD */}
      <div className="absolute inset-0 pointer-events-none ops-grid-bg opacity-30" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(800px_400px_at_20%_0%,hsl(var(--mining-green)/0.12),transparent),radial-gradient(700px_400px_at_80%_100%,hsl(var(--mining-blue)/0.10),transparent)]" />

      {/* TOP BAR */}
      <header className="relative z-10 flex items-center justify-between px-5 py-3 border-b border-mining-green/20 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-mining-green/15 border border-mining-green/40 flex items-center justify-center shadow-[0_0_20px_-4px_hsl(var(--mining-green))]">
            <Mountain className="h-5 w-5 text-mining-green" />
          </div>
          <div>
            <p className="text-[10px] font-mono tracking-[0.25em] text-mining-green/80">SUA MINA</p>
          </div>
        </div>
        <h1 className="text-lg md:text-2xl font-bold tracking-[0.2em] text-foreground text-glow-neon">
          PAINEL DE PRODUÇÃO OPERACIONAL
        </h1>
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <div className="flex items-center gap-2 text-foreground">
            <Calendar className="h-3.5 w-3.5 text-mining-green" />
            <div>
              <p>{clock.toLocaleDateString("pt-BR")}</p>
              <p className="text-mining-green">{clock.toLocaleTimeString("pt-BR")}</p>
            </div>
          </div>
          <div className="border-l border-mining-green/20 pl-4">
            <p className="text-muted-foreground">TURNO ATUAL</p>
            <p className="text-mining-green font-bold">DIA</p>
          </div>
          <div className="border-l border-mining-green/20 pl-4 flex items-center gap-2">
            <RefreshCw className={`h-3.5 w-3.5 text-mining-green ${syncing ? "animate-spin" : ""}`} style={syncing ? undefined : { animationDuration: "4s" }} />
            <div>
              <p className="text-muted-foreground">ÚLTIMO REFRESH</p>
              <p className="text-mining-green">
                {lastUpdated ? lastUpdated.toLocaleTimeString("pt-BR") : "—"}
              </p>
              {source === "onedrive" && file && (
                <p className="text-[9px] text-muted-foreground truncate max-w-[180px]">
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
            className="gap-2 border-mining-green/40 text-mining-green hover:bg-mining-green/10 h-9"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Atualizar agora
          </Button>
          <MicrosoftLoginButton />
          <ExcelUploadButton />
        </div>
      </header>

      <main className="relative z-10 p-3 md:p-4 grid grid-cols-12 gap-3">
        {/* CARDS PRINCIPAIS — linha 1 */}
        <div className="col-span-12 md:col-span-3">
          <CardShell title="PRODUÇÃO DO DIA">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Acumulado Dia:</span>
                <span className="text-2xl font-mono font-bold text-mining-blue">{fmt(summary?.acumuladoDia || producaoTurno)}</span>
              </div>
              <div className="h-px bg-mining-green/15" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Projetado Dia:</span>
                <span className="text-2xl font-mono font-bold text-mining-green text-glow-neon">{fmt(summary?.projetadoDia || summary?.acumuladoDia || producaoTurno)}</span>
              </div>
            </div>
          </CardShell>
        </div>
        <div className="col-span-12 md:col-span-3">
          <CardShell title="RETALUDAMENTO">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Acumulado Dia:</span>
                <span className="text-2xl font-mono font-bold text-mining-blue">{fmt(acumuladoRetaludShown)}</span>
              </div>
              <div className="h-px bg-mining-green/15" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Projetado Dia:</span>
                <span className="text-2xl font-mono font-bold text-mining-green text-glow-neon">{fmt(projetadoRetaludShown)}</span>
              </div>
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[9px] font-mono text-muted-foreground">
                  {retaludOverride ? "lançamento manual" : "auto"}
                </span>
                <Dialog open={retaludOpen} onOpenChange={setRetaludOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-mining-green hover:bg-mining-green/10 gap-1">
                      <Pencil className="h-3 w-3" /> <span className="text-[10px] font-mono">Lançar</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Lançar Retaludamento manual</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="ret-ac">Acumulado Dia (t)</Label>
                        <Input id="ret-ac" type="number" inputMode="decimal" value={retaludForm.acumulado}
                          onChange={(e) => setRetaludForm((s) => ({ ...s, acumulado: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ret-pr">Projetado Dia (t)</Label>
                        <Input id="ret-pr" type="number" inputMode="decimal" value={retaludForm.projetado}
                          onChange={(e) => setRetaludForm((s) => ({ ...s, projetado: e.target.value }))} />
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      {retaludOverride && (
                        <Button variant="ghost" onClick={clearRetalud}>Voltar pra automático</Button>
                      )}
                      <Button onClick={saveRetalud}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardShell>
        </div>
        <div className="col-span-12 md:col-span-3">
          <CardShell title="PRODUÇÃO MENSAL">
            <div className="flex items-end justify-between">
              <p className="text-3xl font-mono font-bold text-mining-green text-glow-neon">{fmt(producaoMensal)} <span className="text-base">t</span></p>
              <p className="text-2xl font-mono font-bold text-foreground">{aderMensal.toFixed(1)}%</p>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>META: {fmt(metaMensal)} t</span>
              <span>DA META</span>
            </div>
            <div className="mt-1.5"><ProgressBar value={aderMensal} /></div>
          </CardShell>
        </div>
        <div className="col-span-12 md:col-span-3">
          <CardShell title="TONELADAS / HORA (MÉDIA DO TURNO)">
            <p className="text-3xl font-mono font-bold text-mining-green text-glow-neon">{fmt(tonH)} <span className="text-base">t/h</span></p>
            <div className="mt-3 text-[10px] font-mono text-muted-foreground">META: {fmt(metaTonH)} t/h</div>
            <div className="mt-1.5"><ProgressBar value={(tonH / metaTonH) * 100} color={BLUE} /></div>
          </CardShell>
        </div>

        {/* GRÁFICO PRODUÇÃO TURNO */}
        <div className="col-span-12 lg:col-span-6">
          <CardShell title="PRODUÇÃO DO TURNO (TONELADAS)">
            <div className="h-56">
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
                    contentStyle={{ background: "#000", border: `1px solid ${NEON}`, fontFamily: "monospace", fontSize: 11 }}
                    labelStyle={{ color: NEON }}
                  />
                  <Area type="monotone" dataKey="realizado" stroke={NEON} strokeWidth={2} fill="url(#prodFill)" name="Realizado" />
                  <Line type="monotone" dataKey="meta" stroke="#9ca3af" strokeDasharray="4 4" strokeWidth={1.5} dot={false} name="Meta" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardShell>
        </div>

        {/* DF POR FROTA */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <CardShell title="% DISPONIBILIDADE FÍSICA POR FROTA">
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
        </div>

        {/* UT POR FROTA */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <CardShell title="UTILIZAÇÃO POR FROTA">
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

        {/* FROTA ESCAVADEIRAS */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <CardShell title={`FROTA DE ESCAVADEIRAS · ${opEscav}/${fleets[0].count + fleets[1].count} OPERANDO`}>
            <div className="space-y-3">
              {[
                { qty: FLEET_SIZE.EX1200, model: "EX1200", prod: fleetsAgg?.EX1200.totalProducao || 61_250, tonH: fleetsAgg?.EX1200.produtividade || 4_200 },
                { qty: FLEET_SIZE.EX2500, model: "EX2500", prod: fleetsAgg?.EX2500.totalProducao || 67_200, tonH: fleetsAgg?.EX2500.produtividade || 6_150 },
              ].map((g) => (
                <div key={g.model} className="flex items-center gap-3 border-t border-mining-green/10 pt-2 first:border-0 first:pt-0">
                  <div className="w-20 h-14 relative">
                    <AnimatedExcavator className="w-20 h-14" />
                  </div>
                  <div>
                    <p className="font-mono font-bold text-foreground"><span className="text-mining-green">{g.qty}x</span> {g.model}</p>
                  </div>
                  <div className="ml-auto text-right text-[10px] font-mono">
                    <p className="text-muted-foreground">PRODUÇÃO</p>
                    <p className="text-mining-green font-bold">{fmt(g.prod)} t</p>
                    <p className="text-muted-foreground mt-0.5">TON/H MÉDIA</p>
                    <p className="text-mining-green font-bold">{fmt(g.tonH)} t/h</p>
                  </div>
                </div>
              ))}
            </div>
          </CardShell>
        </div>

        {/* EQUIPAMENTOS OPERANDO — ao lado da Frota de Escavadeiras */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <CardShell title="EQUIPAMENTOS OPERANDO">
            <div className="flex items-center justify-between h-full min-h-[120px]">
              <div>
                <p className="text-3xl font-mono font-bold text-mining-green text-glow-neon">
                  {opTotal} <span className="text-foreground">/ {FLEET_TOTAL}</span>
                </p>
                <p className="mt-2 text-[10px] font-mono text-muted-foreground">{pctOp.toFixed(1)}% DO TOTAL</p>
              </div>
              <div className="w-24 h-14 relative">
                <AnimatedExcavator className="w-24 h-14" />
              </div>
            </div>
          </CardShell>
        </div>

        {/* TONELADAS POR HORA */}
        <div className="col-span-12 lg:col-span-6">
          <CardShell title="TONELADAS POR HORA">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={tonHSeries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(34,197,94,0.08)" />
                  <XAxis dataKey="hora" stroke="#4ade80" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <YAxis stroke="#4ade80" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <Tooltip contentStyle={{ background: "#000", border: `1px solid ${NEON}`, fontSize: 11, fontFamily: "monospace" }} labelStyle={{ color: NEON }} />
                  <Bar dataKey="tonH" fill={NEON} radius={[2, 2, 0, 0]} name="Ton/h" />
                  <Line type="monotone" dataKey="meta" stroke={YELLOW} strokeDasharray="4 4" strokeWidth={1.5} dot={false} name="Meta" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardShell>
        </div>

        {/* OPERAÇÃO AO VIVO — preenche espaço lateral */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <CardShell title="OPERAÇÃO AO VIVO">
            <div className="relative h-52 overflow-hidden rounded-sm bg-gradient-to-b from-black via-black to-mining-green/5">
              {/* chão */}
              <div className="absolute inset-x-0 bottom-6 h-px bg-gradient-to-r from-transparent via-mining-green/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-3 h-px bg-gradient-to-r from-transparent via-mining-green/20 to-transparent" />

              {/* escavadeira fixa operando */}
              <div className="absolute left-3 bottom-4">
                <AnimatedExcavator className="w-20 h-14" />
              </div>

              {/* caminhões cruzando em loop */}
              <div className="absolute inset-y-0 w-20 animate-truck-drive" style={{ animationDuration: "14s" }}>
                <AnimatedTruck className="w-20 h-12 mt-[120px]" color={YELLOW} />
              </div>
              <div className="absolute inset-y-0 w-20 animate-truck-drive" style={{ animationDuration: "18s", animationDelay: "-6s" }}>
                <AnimatedTruck className="w-20 h-12 mt-[120px]" color="#fb923c" />
              </div>
              <div className="absolute inset-y-0 w-20 animate-truck-drive" style={{ animationDuration: "22s", animationDelay: "-12s" }}>
                <AnimatedTruck className="w-20 h-12 mt-[120px]" color={NEON} />
              </div>

              {/* indicador */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-mining-green animate-pulse" style={{ boxShadow: `0 0 8px ${NEON}` }} />
                <span className="text-[9px] font-mono text-mining-green tracking-[0.2em]">LIVE</span>
              </div>
            </div>
          </CardShell>
        </div>

        {/* RANKING */}
        <div className="col-span-12 lg:col-span-6">
          <CardShell title="RANKING DE PRODUTIVIDADE — ESCAVADEIRAS (T/H)">
            <div className="space-y-1.5">
              {ranking.map((r, i) => {
                const max = ranking[0].value;
                const pct = (r.value / max) * 100;
                return (
                  <div key={r.name} className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="w-4 text-muted-foreground text-right">{r.pos}</span>
                    <span className="w-20 text-foreground">{r.name}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-sm overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, delay: i * 0.05 }}
                        className="h-full rounded-sm"
                        style={{ background: NEON, boxShadow: `0 0 8px ${NEON}` }}
                      />
                    </div>
                    <span className="w-16 text-right text-mining-green font-bold">{fmt(r.value)} t/h</span>
                  </div>
                );
              })}
            </div>
          </CardShell>
        </div>

        {/* FROTA CAMINHÕES */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <CardShell title={`FROTA DE CAMINHÕES · ${opCam}/${FLEET_SIZE["Komatsu 785"] + FLEET_SIZE["Komatsu 730"]} OPERANDO`}>
            <div className="space-y-3">
              {[
                { qty: FLEET_SIZE["Komatsu 785"], model: "HD785", ton: fleetsAgg?.["Komatsu 785"].totalProducao || 89_650, tonH: fleetsAgg?.["Komatsu 785"].produtividade || 9_850 },
                { qty: FLEET_SIZE["Komatsu 730"], model: "HD730", ton: fleetsAgg?.["Komatsu 730"].totalProducao || 38_800, tonH: fleetsAgg?.["Komatsu 730"].produtividade || 4_050 },
              ].map((g) => (
                <div key={g.model} className="flex items-center gap-3 border-t border-mining-green/10 pt-2 first:border-0 first:pt-0">
                  <div className="w-20 h-12 relative">
                    <div className="animate-truck-bounce">
                      <AnimatedTruck className="w-20 h-12" />
                    </div>
                  </div>
                  <div>
                    <p className="font-mono font-bold text-foreground"><span className="text-mining-green">{g.qty}x</span> {g.model}</p>
                  </div>
                  <div className="ml-auto text-right text-[10px] font-mono">
                    <p className="text-muted-foreground">TONELADAS</p>
                    <p className="text-mining-green font-bold">{fmt(g.ton)} t</p>
                    <p className="text-muted-foreground mt-0.5">TON/H MÉDIA</p>
                    <p className="text-mining-green font-bold">{fmt(g.tonH)} t/h</p>
                  </div>
                </div>
              ))}
            </div>
          </CardShell>
        </div>

        {/* FAIXA DE CAMINHÕES ANIMADA — banda inferior */}
        <div className="col-span-12 relative h-14 border border-mining-green/15 rounded-md bg-black/60 overflow-hidden">
          <div className="absolute inset-x-0 bottom-2 h-px bg-gradient-to-r from-transparent via-mining-green/40 to-transparent" />
          <div className="absolute inset-y-0 w-24 animate-truck-drive">
            <AnimatedTruck className="w-24 h-14 mt-0.5" color={YELLOW} />
          </div>
          <div className="absolute inset-y-0 w-24 animate-truck-drive" style={{ animationDuration: "24s", animationDelay: "-7s" }}>
            <AnimatedTruck className="w-24 h-14 mt-0.5" color="#fb923c" />
          </div>
          <div className="absolute inset-y-0 w-24 animate-truck-drive" style={{ animationDuration: "30s", animationDelay: "-14s" }}>
            <AnimatedTruck className="w-24 h-14 mt-0.5" color={NEON} />
          </div>
        </div>
      </main>
    </div>
  );
}