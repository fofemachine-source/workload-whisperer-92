import { useIsAuthenticated } from "@azure/msal-react";
import { useExcelWorkbook } from "@/hooks/useExcelWorkbook";
import { useExcelMetrics } from "@/hooks/useExcelMetrics";
import { TARGET_EQUIPMENT, TargetEquipment } from "@/services/excelParser";
import { Gauge, TrendingUp, Target, BarChart3, Mountain, Activity as ActivityIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Cell,
} from "recharts";

const fmt = (n: number, d = 1) =>
  n
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })
    : "—";
const fmtInt = (n: number) => (n ? Math.round(n).toLocaleString("pt-BR") : "—");

const PURPLE = "hsl(var(--mining-purple))";
const PURPLE_GLOW = "hsl(var(--mining-purple-glow))";
const GREEN = "hsl(var(--mining-green))";
const GREEN_GLOW = "hsl(var(--mining-green-glow))";
const YELLOW = "hsl(var(--mining-yellow))";
const RED = "hsl(var(--mining-red))";

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Gauge;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-mining-purple/25 bg-card/60 backdrop-blur p-5 hover:border-mining-purple/50 transition-colors">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-md bg-mining-purple/15 border border-mining-purple/30 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-mining-purple-glow" />
        </div>
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

const Tip = ({ active, payload, label, suffix }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/90 border border-mining-purple/40 rounded-md px-3 py-2 text-xs font-mono backdrop-blur">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((e: any, i: number) => (
        <p key={i} style={{ color: e.color }} className="font-bold">
          {e.name}: {Number(e.value).toLocaleString("pt-BR")}{suffix ?? ""}
        </p>
      ))}
    </div>
  );
};

function ProductivitySection({ metrics }: { metrics: Record<TargetEquipment, any> | null }) {
  const data = (["EX1200", "EX2500"] as const).map((eq) => ({
    name: eq,
    Produtividade: Number((metrics?.[eq]?.produtividade ?? 0).toFixed(2)),
    Horas: Number((metrics?.[eq]?.horasTrabalhadas ?? 0).toFixed(1)),
    Produção: Math.round(metrics?.[eq]?.producao ?? 0),
  }));
  return (
    <SectionCard icon={TrendingUp} title="Produtividade · Frota" subtitle="EX1200 e EX2500">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--mining-purple) / 0.15)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} cursor={{ fill: "hsl(var(--mining-purple) / 0.08)" }} />
          <Bar dataKey="Produtividade" fill={GREEN_GLOW} radius={[6, 6, 0, 0]} />
          <Bar dataKey="Horas" fill={PURPLE_GLOW} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-3 mt-3 font-mono text-xs">
        {data.map((d) => (
          <div key={d.name} className="rounded-md border border-mining-purple/20 bg-black/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.name}</p>
            <p className="text-mining-green-glow text-lg font-bold">{fmt(d.Produtividade, 2)} <span className="text-[10px] text-muted-foreground">t/h</span></p>
            <p className="text-muted-foreground">{fmt(d.Horas)} h · {fmtInt(d.Produção)} t</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function AreaProductionSection({ areas }: { areas: any }) {
  const rows = (["Mina", "Retaludamento"] as const).map((a) => {
    const x = areas?.[a] ?? { meta: 0, realizado: 0, percentual: 0 };
    const pct = x.percentual || (x.meta ? (x.realizado / x.meta) * 100 : 0);
    return { area: a, meta: x.meta, realizado: x.realizado, pct };
  });
  return (
    <SectionCard icon={BarChart3} title="Produção Realizada" subtitle="Mina e Retaludamento">
      <div className="space-y-4">
        {rows.map((r) => {
          const pct = Math.min(100, r.pct);
          const color = pct >= 95 ? GREEN_GLOW : pct >= 75 ? YELLOW : RED;
          return (
            <div key={r.area}>
              <div className="flex items-baseline justify-between mb-1.5 font-mono">
                <div className="flex items-center gap-2">
                  <Mountain className="h-3.5 w-3.5 text-mining-purple-glow" />
                  <span className="text-xs font-bold text-foreground">{r.area}</span>
                </div>
                <span className="text-xs" style={{ color }}>{fmt(r.pct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-mining-purple/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${PURPLE}, ${color})` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] font-mono text-muted-foreground">
                <span>Realizado: <span className="text-mining-green">{fmtInt(r.realizado)} t</span></span>
                <span>Meta: <span className="text-foreground">{fmtInt(r.meta)} t</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function ProjectionSection({ areas }: { areas: any }) {
  const rows = (["Mina", "Retaludamento"] as const).map((a) => {
    const x = areas?.[a] ?? { meta: 0, projecao: 0, realizado: 0 };
    const proj = x.projecao || x.realizado;
    const pct = x.meta ? (proj / x.meta) * 100 : 0;
    return { area: a, meta: x.meta, proj, pct };
  });
  return (
    <SectionCard icon={Target} title="Projeção para o Dia" subtitle="Mina e Retaludamento">
      <div className="grid grid-cols-2 gap-3">
        {rows.map((r) => {
          const pct = Math.min(100, r.pct);
          const color = pct >= 95 ? GREEN_GLOW : pct >= 75 ? YELLOW : RED;
          return (
            <div key={r.area} className="rounded-lg border border-mining-purple/25 bg-black/30 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{r.area}</p>
              <ResponsiveContainer width="100%" height={120}>
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: pct, fill: color }]} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "hsl(var(--mining-purple) / 0.15)" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="text-2xl font-bold font-mono -mt-12" style={{ color }}>{fmt(r.pct)}%</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-8">
                {fmtInt(r.proj)} / {fmtInt(r.meta)} t
              </p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function FleetGaugeSection({
  metrics,
  field,
  title,
  subtitle,
  icon,
}: {
  metrics: Record<TargetEquipment, any> | null;
  field: "df" | "ut";
  title: string;
  subtitle: string;
  icon: typeof Gauge;
}) {
  const data = TARGET_EQUIPMENT.map((eq) => ({
    name: eq,
    value: Number((metrics?.[eq]?.[field] ?? 0).toFixed(1)),
  }));
  return (
    <SectionCard icon={icon} title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--mining-purple) / 0.15)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} width={90} />
          <Tooltip content={<Tip suffix="%" />} cursor={{ fill: "hsl(var(--mining-purple) / 0.08)" }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} background={{ fill: "hsl(var(--mining-purple) / 0.1)" }}>
            {data.map((d, i) => {
              const c = d.value >= 85 ? GREEN_GLOW : d.value >= 70 ? YELLOW : RED;
              return <Cell key={i} fill={c} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

export function OperationsSections() {
  const isAuth = useIsAuthenticated();
  const { file, worksheets } = useExcelWorkbook(isAuth);
  const { metrics, areas } = useExcelMetrics(file, worksheets);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <ProductivitySection metrics={metrics} />
      <AreaProductionSection areas={areas} />
      <ProjectionSection areas={areas} />
      <FleetGaugeSection metrics={metrics} field="df" title="DF % · Frota" subtitle="Disponibilidade Física" icon={Gauge} />
      <FleetGaugeSection metrics={metrics} field="ut" title="UT % · Frota" subtitle="Utilização Operacional" icon={ActivityIcon} />
      <div className="hidden xl:block" />
    </div>
  );
}