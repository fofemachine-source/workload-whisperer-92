import { useMemo } from "react";
import { useExcelLive } from "@/context/ExcelLiveContext";
import { TARGET_EQUIPMENT, TargetEquipment } from "@/services/excelParser";
import { TrendingUp, Gauge, Activity, BarChart3 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
} from "recharts";

const BLUE = "hsl(var(--mining-blue))";
const BLUE_GLOW = "hsl(var(--mining-blue-glow))";
const CYAN = "hsl(var(--mining-cyan))";
const GREEN = "hsl(var(--mining-green))";
const GREEN_GLOW = "hsl(var(--mining-green-glow))";
const YELLOW = "hsl(var(--mining-yellow))";
const RED = "hsl(var(--mining-red))";
const PURPLE = "hsl(var(--mining-purple))";

const fmt = (n: number, d = 1) =>
  n ? n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

function Panel({
  icon: Icon,
  title,
  subtitle,
  children,
  tone = "blue",
  className = "",
}: {
  icon: typeof TrendingUp;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  tone?: "blue" | "green" | "cyan" | "purple";
  className?: string;
}) {
  const map = {
    blue: "text-mining-blue-glow",
    green: "text-mining-green-glow",
    cyan: "text-mining-cyan",
    purple: "text-mining-purple-glow",
  } as const;
  return (
    <div className={`ops-card ops-card-hover p-5 animate-fade-in ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-lg bg-black/40 border border-mining-blue/20 flex items-center justify-center ${map[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">{title}</h3>
            {subtitle && <p className="text-[10px] text-muted-foreground font-mono">{subtitle}</p>}
          </div>
        </div>
        <span className="text-[9px] font-mono text-mining-green tracking-wider flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-mining-green animate-pulse" />
          LIVE
        </span>
      </div>
      {children}
    </div>
  );
}

const Tip = ({ active, payload, label, suffix = "" }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-mining-blue/30 bg-black/95 px-3 py-2 backdrop-blur-xl shadow-xl">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-mono">{label}</p>
      {payload.map((e: any, i: number) => (
        <p key={i} className="text-xs font-mono font-bold" style={{ color: e.color || e.fill }}>
          {e.name}: {Number(e.value).toLocaleString("pt-BR")}{suffix}
        </p>
      ))}
    </div>
  );
};

function ProductionAreaChart() {
  const { areas } = useExcelLive();
  // Build a smooth synthetic intraday curve from real Excel totals (meta vs realizado)
  const meta = areas?.Mina?.meta ?? 0;
  const real = areas?.Mina?.realizado ?? 0;
  const projecao = areas?.Mina?.projecao ?? real;

  const data = useMemo(() => {
    const hours = ["00", "03", "06", "09", "12", "15", "18", "21", "24"];
    return hours.map((h, i) => {
      const k = (i + 1) / hours.length;
      const ease = 1 - Math.pow(1 - k, 1.6);
      return {
        h,
        Planejado: Math.round(meta * k),
        Realizado: Math.round(real * ease),
        Projeção: Math.round(projecao * Math.min(1, k * 1.05)),
      };
    });
  }, [meta, real, projecao]);

  return (
    <Panel icon={TrendingUp} title="Produção Diária" subtitle="Planejado · Realizado · Projeção" tone="green" className="xl:col-span-2">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gPlan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE_GLOW} stopOpacity={0.45} />
              <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gReal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREEN_GLOW} stopOpacity={0.55} />
              <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gProj" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CYAN} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--mining-blue) / 0.1)" />
          <XAxis dataKey="h" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip suffix=" t" />} />
          <Area type="monotone" dataKey="Planejado" stroke={BLUE_GLOW} strokeWidth={2} fill="url(#gPlan)" />
          <Area type="monotone" dataKey="Projeção" stroke={CYAN} strokeWidth={2} strokeDasharray="4 3" fill="url(#gProj)" />
          <Area type="monotone" dataKey="Realizado" stroke={GREEN_GLOW} strokeWidth={2.5} fill="url(#gReal)" />
        </AreaChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function ProductivityChart() {
  const { metrics } = useExcelLive();
  const data = TARGET_EQUIPMENT.map((eq) => ({
    name: eq.replace("Komatsu ", "K"),
    Produtividade: Number((metrics?.[eq]?.produtividade ?? 0).toFixed(2)),
  }));
  return (
    <Panel icon={BarChart3} title="Produtividade · Frota" subtitle="t/h por equipamento" tone="green">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--mining-blue) / 0.1)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip suffix=" t/h" />} cursor={{ fill: "hsl(var(--mining-blue) / 0.06)" }} />
          <Bar dataKey="Produtividade" radius={[8, 8, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={i % 2 ? GREEN_GLOW : BLUE_GLOW} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function FleetGauge({
  field,
  title,
  subtitle,
  icon,
  tone,
}: {
  field: "df" | "ut";
  title: string;
  subtitle: string;
  icon: typeof Gauge;
  tone: "blue" | "cyan";
}) {
  const { metrics } = useExcelLive();
  const data = TARGET_EQUIPMENT.map((eq) => ({
    name: eq.replace("Komatsu ", "K"),
    value: Number((metrics?.[eq]?.[field] ?? 0).toFixed(1)),
  }));
  return (
    <Panel icon={icon} title={title} subtitle={subtitle} tone={tone}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--mining-blue) / 0.1)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} width={68} />
          <Tooltip content={<Tip suffix="%" />} cursor={{ fill: "hsl(var(--mining-blue) / 0.06)" }} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} background={{ fill: "hsl(var(--mining-blue) / 0.08)" }}>
            {data.map((d, i) => {
              const c = d.value >= 85 ? GREEN_GLOW : d.value >= 70 ? YELLOW : d.value > 0 ? RED : "hsl(var(--muted))";
              return <Cell key={i} fill={c} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  );
}

function FleetStatus() {
  const { metrics } = useExcelLive();
  // Heuristic: classify each equipment based on its UT/DF/manutenção
  const counters = { Operando: 0, Manutenção: 0, Espera: 0 };
  TARGET_EQUIPMENT.forEach((eq) => {
    const m = metrics?.[eq];
    const ut = m?.ut ?? 0;
    const manut = m?.manutencao ?? 0;
    if (manut > 0 && ut < 30) counters.Manutenção++;
    else if (ut >= 50) counters.Operando++;
    else counters.Espera++;
  });
  const total = TARGET_EQUIPMENT.length;
  const data = [
    { name: "Operando", value: counters.Operando, fill: GREEN_GLOW },
    { name: "Manutenção", value: counters.Manutenção, fill: YELLOW },
    { name: "Espera", value: counters.Espera, fill: PURPLE },
  ];
  return (
    <Panel icon={Activity} title="Status da Frota" subtitle="Operando · Manutenção · Espera" tone="purple">
      <ResponsiveContainer width="100%" height={220}>
        <RadialBarChart innerRadius="40%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, total]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "hsl(var(--mining-blue) / 0.08)" }} />
          <Tooltip content={<Tip suffix=" eq." />} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-center">
        {data.map((d) => (
          <div key={d.name} className="rounded-lg border border-mining-blue/15 bg-black/30 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.name}</p>
            <p className="text-xl font-bold" style={{ color: d.fill }}>{d.value}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FleetTable() {
  const { metrics } = useExcelLive();
  return (
    <Panel icon={BarChart3} title="Frota · Tempo Real" subtitle="Dados do Excel OneDrive" tone="blue" className="xl:col-span-3">
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-xs min-w-[720px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-mining-blue-glow border-b border-mining-blue/20">
              <th className="px-3 py-2">Equipamento</th>
              <th className="px-3 py-2">Horas</th>
              <th className="px-3 py-2">Produção</th>
              <th className="px-3 py-2">Prod.</th>
              <th className="px-3 py-2">Manut.</th>
              <th className="px-3 py-2">DF%</th>
              <th className="px-3 py-2">UT%</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {TARGET_EQUIPMENT.map((eq, i) => {
              const m = metrics?.[eq as TargetEquipment];
              return (
                <tr key={eq} className={`border-b border-mining-blue/10 hover:bg-mining-blue/5 transition-colors ${i % 2 ? "" : "bg-black/20"}`}>
                  <td className="px-3 py-2.5 font-bold text-foreground">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-mining-green shadow-[0_0_8px_hsl(var(--mining-green))]" />
                      {eq}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-mining-blue-glow">{fmt(m?.horasTrabalhadas ?? 0)} h</td>
                  <td className="px-3 py-2.5 text-mining-green">{fmt(m?.producao ?? 0, 0)} t</td>
                  <td className="px-3 py-2.5 text-mining-green-glow font-bold">{fmt(m?.produtividade ?? 0, 2)}</td>
                  <td className="px-3 py-2.5 text-mining-yellow">{fmt(m?.manutencao ?? 0)}</td>
                  <td className="px-3 py-2.5">{fmt(m?.df ?? 0)}%</td>
                  <td className="px-3 py-2.5">{fmt(m?.ut ?? 0)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function OperationsCharts() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <ProductionAreaChart />
      <FleetStatus />
      <ProductivityChart />
      <FleetGauge field="df" title="DF % · Frota" subtitle="Disponibilidade Física" icon={Gauge} tone="blue" />
      <FleetGauge field="ut" title="UT % · Frota" subtitle="Utilização Operacional" icon={Activity} tone="cyan" />
      <FleetTable />
    </div>
  );
}