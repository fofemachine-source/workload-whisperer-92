import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from "recharts";

interface ProductionChartProps {
  data: Array<{
    label: string;
    realizado: number;
    planejado: number;
  }>;
  title: string;
  type?: "bar" | "line";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-mono font-semibold" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toLocaleString("pt-BR")} t
        </p>
      ))}
    </div>
  );
};

export function ProductionChart({ data, title, type = "bar" }: ProductionChartProps) {
  const Chart = type === "line" ? LineChart : BarChart;

  return (
    <div className="bg-card rounded-lg p-5 border border-border">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <Chart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 19% 22%)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(215 16% 57%)" }} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(215 16% 57%)" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {type === "bar" ? (
            <>
              <Bar dataKey="planejado" name="Planejado" fill="hsl(239 84% 67%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="realizado" name="Realizado" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
            </>
          ) : (
            <>
              <Line dataKey="planejado" name="Planejado" stroke="hsl(239 84% 67%)" strokeWidth={2} dot={false} />
              <Line dataKey="realizado" name="Realizado" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
            </>
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
