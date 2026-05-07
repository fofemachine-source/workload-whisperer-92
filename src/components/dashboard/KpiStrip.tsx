import { useExcelLive } from "@/context/ExcelLiveContext";
import { TARGET_EQUIPMENT, FLEET_SIZE, FLEET_TOTAL } from "@/services/excelParser";
import { Activity, Gauge, TrendingUp, Truck, Mountain, Shovel } from "lucide-react";

const fmt = (n: number, d = 1) =>
  n ? n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "0";

function avg(values: number[]) {
  const v = values.filter((x) => x > 0);
  if (!v.length) return 0;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone,
  delta,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone: "blue" | "green" | "purple" | "cyan" | "yellow" | "indigo";
  delta?: string;
}) {
  const toneMap: Record<string, { ring: string; text: string; bg: string; glow: string }> = {
    blue: { ring: "border-mining-blue/30", text: "text-mining-blue-glow", bg: "from-mining-blue/15 to-transparent", glow: "shadow-[0_0_30px_-10px_hsl(var(--mining-blue))]" },
    green: { ring: "border-mining-green/30", text: "text-mining-green-glow", bg: "from-mining-green/15 to-transparent", glow: "shadow-[0_0_30px_-10px_hsl(var(--mining-green))]" },
    purple: { ring: "border-mining-purple/30", text: "text-mining-purple-glow", bg: "from-mining-purple/15 to-transparent", glow: "shadow-[0_0_30px_-10px_hsl(var(--mining-purple))]" },
    cyan: { ring: "border-mining-cyan/30", text: "text-mining-cyan", bg: "from-mining-cyan/15 to-transparent", glow: "shadow-[0_0_30px_-10px_hsl(var(--mining-cyan))]" },
    yellow: { ring: "border-mining-yellow/30", text: "text-mining-yellow", bg: "from-mining-yellow/15 to-transparent", glow: "shadow-[0_0_30px_-10px_hsl(var(--mining-yellow))]" },
    indigo: { ring: "border-mining-indigo/30", text: "text-mining-indigo", bg: "from-mining-indigo/15 to-transparent", glow: "shadow-[0_0_30px_-10px_hsl(var(--mining-indigo))]" },
  };
  const t = toneMap[tone];
  return (
    <div className={`ops-card ops-card-hover ${t.ring} relative overflow-hidden p-4 animate-fade-in`}>
      <div className={`absolute inset-x-0 -top-12 h-24 bg-gradient-to-b ${t.bg} blur-2xl pointer-events-none`} />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg border ${t.ring} ${t.glow} bg-black/30 flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${t.text}`} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-bold">{label}</p>
        </div>
        {delta && <span className={`text-[10px] font-mono ${t.text}`}>{delta}</span>}
      </div>
      <div className="relative mt-3 flex items-baseline gap-1.5 font-mono">
        <span className={`text-3xl md:text-4xl font-bold tabular-nums ${t.text}`}>{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {hint && <p className="relative mt-1 text-[11px] text-muted-foreground font-mono">{hint}</p>}
    </div>
  );
}

export function KpiStrip() {
  const { metrics, areas, summary } = useExcelLive();

  // Prefer generic summary (works with any spreadsheet); fallback to fixed-target metrics.
  const prods = TARGET_EQUIPMENT.map((e) => metrics?.[e]?.produtividade ?? 0);
  const uts = TARGET_EQUIPMENT.map((e) => metrics?.[e]?.ut ?? 0);
  const dfs = TARGET_EQUIPMENT.map((e) => metrics?.[e]?.df ?? 0);

  const produtividade = summary?.produtividade || avg(prods);
  const ut = summary?.ut || avg(uts);
  const df = summary?.df || avg(dfs);

  const totalRealizado =
    summary?.totalRealizado || (areas?.Mina?.realizado ?? 0) + (areas?.Retaludamento?.realizado ?? 0);
  const totalMeta = summary?.totalMeta || (areas?.Mina?.meta ?? 0) + (areas?.Retaludamento?.meta ?? 0);
  const aderencia = summary?.aderencia || (totalMeta ? (totalRealizado / totalMeta) * 100 : 0);

  const escavOperando =
    summary?.totalEscavadeiras ||
    ["EX1200", "EX2500"].filter((e) => (metrics?.[e as "EX1200"]?.horasTrabalhadas ?? 0) > 0).length;
  const escavTotal = FLEET_SIZE.EX1200 + FLEET_SIZE.EX2500; // 8
  const camOperando =
    summary?.totalCaminhoes ||
    ["Komatsu 730", "Komatsu 785"].filter(
      (e) => (metrics?.[e as "Komatsu 730"]?.horasTrabalhadas ?? 0) > 0,
    ).length;
  const camTotal = FLEET_SIZE["Komatsu 730"] + FLEET_SIZE["Komatsu 785"]; // 40

  return (
    <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard
        icon={TrendingUp}
        label="Produtividade"
        value={fmt(produtividade, 2)}
        unit="t/h"
        hint="Ton movimentada / h escavadeiras"
        tone="green"
      />
      <KpiCard
        icon={Activity}
        label="Utilização (UT%)"
        value={fmt(ut)}
        unit="%"
        hint="Horas usadas / horas disponíveis"
        tone="cyan"
      />
      <KpiCard
        icon={Gauge}
        label="Disp. Física (DF%)"
        value={fmt(df)}
        unit="%"
        hint="(Total - manutenção) / total"
        tone="blue"
      />
      <KpiCard
        icon={Mountain}
        label="Aderência"
        value={fmt(aderencia)}
        unit="%"
        hint={`${Math.round(totalRealizado)} / ${Math.round(totalMeta)} t`}
        tone="purple"
      />
      <KpiCard
        icon={Shovel}
        label="Escavadeiras"
        value={`${escavOperando}/${escavTotal}`}
        hint="EX1200 (5) + EX2500 (3)"
        tone="yellow"
      />
      <KpiCard
        icon={Truck}
        label="Caminhões"
        value={`${camOperando}/${camTotal}`}
        hint={`Frota total: ${FLEET_TOTAL} eq.`}
        tone="indigo"
      />
    </section>
  );
}