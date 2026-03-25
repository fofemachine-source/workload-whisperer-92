import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface EquipmentStatusChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  title: string;
}

export function EquipmentStatusChart({ data, title }: EquipmentStatusChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-card rounded-lg p-5 border border-border">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={data}
              innerRadius={40}
              outerRadius={65}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value} equip.`, ""]}
              contentStyle={{
                backgroundColor: "hsl(217 28% 12%)",
                border: "1px solid hsl(217 19% 22%)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.name}</span>
              <span className="text-xs font-mono font-bold text-foreground ml-auto">
                {item.value} <span className="text-muted-foreground font-normal">({total > 0 ? Math.round((item.value / total) * 100) : 0}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
