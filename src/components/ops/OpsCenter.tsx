import { useEffect, useState, useMemo } from "react";
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
  Cell,
  LabelList,
  ReferenceLine,
} from "recharts";
import { useProducaoDiaria, type ProducaoDiariaRow } from "@/hooks/useProducaoDiaria";
import { useProducaoFrente, useProducaoEquipamento } from "@/hooks/useProducaoKpis";
import { AnimatedTruck } from "./AnimatedTruck";
import logoUM from "@/assets/logo-um.png";
import { AnimatedExcavator } from "./AnimatedExcavator";

// Frota operacional fixa (antes vinha de excelParser).
const FLEET_SIZE = {
  "Komatsu 785": 25,
  "Komatsu 730": 15,
  EX2500: 3,
  EX1200: 5,
} as const;
const FLEET_TOTAL = 48;

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

function thresholdColor(v: number): string {
  if (v >= 85) return "#22c55e"; // verde
  if (v >= 75) return "#facc15"; // amarelo
  return "#ef4444"; // vermelho
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
  value: number | null;
  meta: number;
  color?: string;
  iconColor?: string;
}) {
  const hasData = value !== null && Number.isFinite(value);
  const dynamicColor = hasData ? thresholdColor(value as number) : color;
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
      {hasData ? (
        <Donut value={value as number} color={dynamicColor} />
      ) : (
        <div className="h-14 px-2 flex items-center justify-center">
          <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-mining-yellow/80 uppercase text-center leading-tight">
            Aguardando<br />dados
          </span>
        </div>
      )}
      <div className="text-right w-24 shrink-0">
        <p className="text-lg font-mono text-muted-foreground uppercase">Meta</p>
        <p className="text-2xl font-mono font-bold text-foreground whitespace-nowrap">{meta.toFixed(1)}%</p>
      </div>
    </div>
  );
}

export function OpsCenter() {
  // ============================================================
  // FONTE ÚNICA DE DADOS: Supabase producao_diaria
  // (populada pelo agente SSRS via Edge Function ingest-mineops)
  // ============================================================
  const { data: producao, isLoading, error } = useProducaoDiaria(35);
  const { data: frentes } = useProducaoFrente(2);
  const { data: equipamentos } = useProducaoEquipamento(2);
  const clock = useClock();

  // Hard reload a cada 60s (TV Dashboard)
  useEffect(() => {
    const hardRefresh = setInterval(() => window.location.reload(), 60000);
    return () => clearInterval(hardRefresh);
  }, []);

  // Chave do dia local (America/Sao_Paulo) no formato YYYY-MM-DD
  const todayKey = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(clock);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }, [clock]);
  const monthKey = todayKey.slice(0, 7);

  const rows: ProducaoDiariaRow[] = producao ?? [];

  // Linha mais recente (fonte primária para T/H e produção)
  const latestRow = rows[0];

  // ----- Agregações a partir de producao_diaria -----
  // Produção do dia: usa a linha mais recente (turno corrente) conforme regra do painel.
  const rowsHoje = rows.filter((r) => r.data_referencia === todayKey);
  const acumuladoDiaMina = Number(
    latestRow?.toneladas_total ??
      rowsHoje.reduce((s, r) => s + Number(r.toneladas_total || 0), 0),
  );

  // Projetado do dia: por enquanto = acumulado (campo dedicado ainda não existe no schema)
  const projetadoDiaMina = acumuladoDiaMina;

  // Retaludamento — schema atual não separa Mina vs Retaludamento.
  // TODO: quando o agente SSRS enviar essa segregação, mapear aqui.
  const acumuladoDiaRetalud = 0;
  const projetadoDiaRetalud = 0;

  // Produção mensal = SUM(toneladas_total) do mês corrente
  const rowsMes = rows.filter((r) => (r.data_referencia || "").startsWith(monthKey));
  const producaoMensal = rowsMes.reduce((s, r) => s + Number(r.toneladas_total || 0), 0);

  // T/H — valor da linha mais recente de producao_diaria (turno atual).
  const tonH = Number(latestRow?.producao_hora || 0);

  // ----- Metas fixas operacionais -----
  const metaTonH = 11500;
  const metaMensalMina = 1_351_130;
  const metaMensalRetalud = 1_241_297;
  const metaMensal = metaMensalMina + metaMensalRetalud;
  const aderMensal = metaMensal > 0 ? (producaoMensal / metaMensal) * 100 : 0;
  const shareMetaMina = (metaMensalMina / metaMensal) * 100;
  const shareMetaRetalud = (metaMensalRetalud / metaMensal) * 100;

  // ----- Série horária (Toneladas por Hora) -----
  // Sem timestamp por hora no schema: usamos os últimos 24 registros do mês
  // ordenados por data, mostrando producao_hora de cada um.
  const tonHSeries = useMemo(() => {
    const ordered = [...rowsMes]
      .sort((a, b) => (a.data_referencia || "").localeCompare(b.data_referencia || ""))
      .slice(-24);
    if (ordered.length === 0) {
      return Array.from({ length: 24 }, (_, h) => ({
        hora: `${String(h).padStart(2, "0")}:00`,
        tonH: 0,
        meta: metaTonH,
      }));
    }
    return ordered.map((r, i) => ({
      hora: r.turno ? `${r.data_referencia?.slice(8)}/${r.turno}` : `${String(i).padStart(2, "0")}`,
      tonH: Math.round(Number(r.producao_hora || 0)),
      meta: metaTonH,
    }));
  }, [rowsMes]);

  // ----- Ranking EH (producao_equipamento) -----
  const rankingEH = useMemo(() => {
    if (!equipamentos || equipamentos.length === 0) return [];
    const sorted = [...equipamentos].sort((a, b) =>
      (b.data_referencia + b.turno).localeCompare(a.data_referencia + a.turno),
    );
    const head = sorted[0];
    return sorted
      .filter((e) => e.data_referencia === head.data_referencia && e.turno === head.turno)
      .sort((a, b) => Number(b.toneladas) - Number(a.toneladas))
      .slice(0, 10);
  }, [equipamentos]);

  // ----- Produção por Frente (producao_frente) -----
  const frentesAtuais = useMemo(() => {
    if (!frentes || frentes.length === 0) return [];
    const sorted = [...frentes].sort((a, b) =>
      (b.data_referencia + b.turno).localeCompare(a.data_referencia + a.turno),
    );
    const head = sorted[0];
    return sorted
      .filter((f) => f.data_referencia === head.data_referencia && f.turno === head.turno)
      .filter((f) => {
        const nome = String(f.frente || "").toUpperCase();
        return !nome.includes("GELADO") && !nome.includes("GEL") && !nome.includes("TESTE") && !nome.includes("DEMO");
      })
      .sort((a, b) => Number(b.toneladas) - Number(a.toneladas));
  }, [frentes]);

  // ----- Frotas (DF/UT) -----
  // DF/UT por modelo ainda não vem desagregado em producao_diaria.
  // Mostramos o DF/UT geral do registro mais recente para todas as frotas.
  const latest = rows[0];
  const dfRaw = latest?.disponibilidade_fisica_df;
  const utRaw = latest?.utilizacao_ut;
  const dfGeral: number | null =
    dfRaw !== null && dfRaw !== undefined && Number.isFinite(Number(dfRaw)) && Number(dfRaw) > 0
      ? Number(dfRaw)
      : null;
  const utGeral: number | null =
    utRaw !== null && utRaw !== undefined && Number.isFinite(Number(utRaw)) && Number(utRaw) > 0
      ? Number(utRaw)
      : null;
  const fleets = [
    { key: "EX1200", name: "EX1200", icon: "ex" as const, count: FLEET_SIZE.EX1200, df: dfGeral, ut: utGeral },
    { key: "EX2500", name: "EX2500", icon: "ex" as const, count: FLEET_SIZE.EX2500, df: dfGeral, ut: utGeral },
    { key: "K785", name: "CAMINHÕES 785", icon: "truck" as const, count: FLEET_SIZE["Komatsu 785"], df: dfGeral, ut: utGeral },
    { key: "K730", name: "CAMINHÕES 730", icon: "truck" as const, count: FLEET_SIZE["Komatsu 730"], df: dfGeral, ut: utGeral },
  ];

  // Logs úteis em produção
  if (error) console.error("[OpsCenter] erro producao_diaria:", error);
  void isLoading;
  void FLEET_TOTAL;

  return (
    <div className="min-h-screen bg-black text-foreground relative overflow-hidden">
      {/* fundo HUD */}
      <div className="absolute inset-0 pointer-events-none ops-grid-bg opacity-30" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(800px_400px_at_20%_0%,hsl(var(--mining-green)/0.12),transparent),radial-gradient(700px_400px_at_80%_100%,hsl(var(--mining-blue)/0.10),transparent)]" />


      <main className="relative z-10 p-3 md:p-4 grid grid-cols-12 gap-3">
        {/* STATUS STRIP — última linha de producao_diaria (tempo real) */}
        <div className="col-span-12">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 py-2 bg-black/70 border border-mining-green/25 rounded-md">
            <span className="text-xs font-mono uppercase tracking-[0.18em] text-mining-green">
              Última leitura SSRS
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              Data: <span className="text-foreground">{latestRow?.data_referencia ?? "—"}</span>
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              Turno: <span className="text-foreground uppercase">{latestRow?.turno ?? "—"}</span>
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              Origem: <span className="text-foreground">{latestRow?.relatorio_origem ?? "—"}</span>
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              Toneladas: <span className="text-mining-blue">{fmt(Number(latestRow?.toneladas_total || 0))}</span>
            </span>
            <span className="text-sm font-mono text-muted-foreground">
              Produção/h: <span className="text-mining-green">{fmt(Number(latestRow?.producao_hora || 0))} t/h</span>
            </span>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground">
              {isLoading ? "atualizando..." : "● ao vivo"}
            </span>
          </div>
        </div>

        {/* LINHA 1: 4 cards principais */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 flex">
          <CardShell title="MINA" className="flex-1 flex flex-col">
            <div className="space-y-2 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-mono text-muted-foreground uppercase tracking-wider">ACUMULADO DIA:</span>
                <span className="text-2xl font-mono font-bold text-mining-blue">
                  {fmt(acumuladoDiaMina)}
                </span>
              </div>
              <div className="h-px bg-mining-green/15" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-mono text-muted-foreground uppercase tracking-wider">PROJETADO DIA:</span>
                <span className="text-2xl font-mono font-bold text-mining-green text-glow-neon">
                  {fmt(projetadoDiaMina)}
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
                <span className="text-2xl font-mono font-bold text-mining-blue">{fmt(acumuladoDiaRetalud)}</span>
              </div>
              <div className="h-px bg-mining-green/15" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-mono text-muted-foreground uppercase tracking-wider">PROJETADO DIA:</span>
                <span className="text-2xl font-mono font-bold text-mining-green text-glow-neon">
                  {fmt(projetadoDiaRetalud)}
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
              <div className="mt-1.5 relative">
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
              <div className="mt-1.5 relative">
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
                  <Bar dataKey="tonH" fill={NEON} radius={[2, 2, 0, 0]} name="Ton/h" isAnimationActive={false} />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    stroke={YELLOW}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                    name="Meta"
                    isAnimationActive={false}
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

        {/* COLUNA DIREITA: RANKING EH + PRODUÇÃO POR FRENTE */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-3">
          <CardShell title="🏆 RANKING EH">
            <div className="space-y-1.5">
              {rankingEH.length === 0 ? (
                <p className="text-sm text-muted-foreground font-mono">Sem dados de equipamentos para o turno atual.</p>
              ) : (
                rankingEH.map((e, idx) => {
                  const max = rankingEH[0].toneladas || 1;
                  const pct = (e.toneladas / max) * 100;
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}º`;
                  return (
                    <div key={e.id} className="flex items-center gap-2 text-sm">
                      <span className="w-6 text-right font-mono text-mining-yellow font-bold">{medal}</span>
                      <span className="w-20 font-mono text-foreground truncate" title={e.equipamento}>{e.equipamento}</span>
                      <span className="w-24 text-xs text-muted-foreground truncate">{e.tipo ?? "—"}</span>
                      <div className="flex-1 h-2.5 bg-white/5 rounded overflow-hidden">
                        <div
                          className="h-full bg-mining-green"
                          style={{ width: `${pct}%`, boxShadow: `0 0 6px ${NEON}` }}
                        />
                      </div>
                      <span className="w-20 text-right font-mono text-mining-green">{fmt(e.toneladas)} t</span>
                    </div>
                  );
                })
              )}
            </div>
          </CardShell>

          <CardShell title="🗺️ PRODUÇÃO POR FRENTE">
            <div className="space-y-1.5">
              {frentesAtuais.length === 0 ? (
                <p className="text-sm text-muted-foreground font-mono">Sem dados de frentes para o turno atual.</p>
              ) : (
                frentesAtuais.map((f) => {
                  const max = frentesAtuais[0].toneladas || 1;
                  const pct = (f.toneladas / max) * 100;
                  return (
                    <div key={f.id} className="flex items-center gap-2 text-sm">
                      <span className="w-20 font-mono text-foreground truncate" title={f.frente}>{f.frente}</span>
                      <div className="flex-1 h-2.5 bg-white/5 rounded overflow-hidden">
                        <div
                          className="h-full bg-mining-blue"
                          style={{ width: `${pct}%`, boxShadow: `0 0 6px ${BLUE}` }}
                        />
                      </div>
                      <span className="w-20 text-right font-mono text-mining-blue">{fmt(f.toneladas)} t</span>
                      <span className="w-16 text-right font-mono text-muted-foreground text-xs">{fmt(Number(f.producao_hora || 0))} t/h</span>
                    </div>
                  );
                })
              )}
            </div>
          </CardShell>
        </div>

        {/* FAIXA DE CAMINHÕES ANIMADA — banda inferior */}
        <div className="col-span-12 relative h-14 border border-mining-green/15 rounded-md bg-black/60 overflow-hidden">
          <div className="absolute inset-x-0 bottom-2 h-px bg-gradient-to-r from-transparent via-mining-green/40 to-transparent" />
          <div className="absolute inset-y-0 w-24 animate-truck-roundtrip">
            <AnimatedTruck className="w-24 h-14 mt-0.5" color={YELLOW} />
          </div>
          <div
            className="absolute inset-y-0 w-24 animate-truck-roundtrip"
            style={{ animationDuration: "28s", animationDelay: "-9s" }}
          >
            <AnimatedTruck className="w-24 h-14 mt-0.5" color="#fb923c" />
          </div>
          <div
            className="absolute inset-y-0 w-24 animate-truck-roundtrip"
            style={{ animationDuration: "34s", animationDelay: "-17s" }}
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
