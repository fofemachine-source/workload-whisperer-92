import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  borderColor?: "blue" | "green" | "yellow" | "red" | "indigo";
}

const borderColors = {
  blue: "border-b-mining-blue",
  green: "border-b-mining-green",
  yellow: "border-b-mining-yellow",
  red: "border-b-mining-red",
  indigo: "border-b-mining-indigo",
};

const TrendIcon = ({ trend }: { trend: "up" | "down" | "neutral" }) => {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-mining-green" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-mining-red" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
};

export function KpiCard({ label, value, unit, trend, trendValue, borderColor = "blue" }: KpiCardProps) {
  return (
    <div className={`bg-card rounded-lg p-4 border-b-4 ${borderColors[borderColor]} transition-colors hover:bg-mining-card-hover`}>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">{label}</p>
      <div className="flex items-end gap-1.5 mt-2">
        <span className="text-2xl font-bold font-mono animate-count-up">{value}</span>
        {unit && <span className="text-sm text-muted-foreground mb-0.5">{unit}</span>}
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-1.5">
          <TrendIcon trend={trend} />
          <span className="text-xs text-muted-foreground">{trendValue}</span>
        </div>
      )}
    </div>
  );
}
