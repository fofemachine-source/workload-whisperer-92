import { Link } from "react-router-dom";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Clock, Database, Gauge, Loader2, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProducaoDiaria } from "@/hooks/useProducaoDiaria";

const fmt = (n: number, d = 0) =>
  (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h atrás`;
  return `${Math.floor(h / 24)} d atrás`;
}

export default function ProducaoDashboard() {
  const { data: producao, isLoading } = useProducaoDiaria(30);
  const rows = producao ?? [];
  const latest = rows[0];

  const lastUpdate = latest?.atualizado_em ?? null;
  const minutesSince = lastUpdate
    ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 60000)
    : Infinity;
  const online = minutesSince < 10;

  // Série últimos 30 dias — soma toneladas por data
  const dailySeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = r.data_referencia;
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + Number(r.toneladas_total || 0));
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([data, ton]) => ({
        data: data.slice(5), // MM-DD
        toneladas: Math.round(ton),
      }));
  }, [rows]);

  // Série por turno — soma toneladas agrupada por turno
  const turnoSeries = useMemo(() => {
    const acc: Record<string, number> = { turno1: 0, turno2: 0, turno3: 0 };
    for (const r of rows) {
      const t = (r.turno || "").toLowerCase();
      if (t in acc) acc[t] += Number(r.toneladas_total || 0);
    }
    return [
      { turno: "Turno 1", toneladas: Math.round(acc.turno1) },
      { turno: "Turno 2", toneladas: Math.round(acc.turno2) },
      { turno: "Turno 3", toneladas: Math.round(acc.turno3) },
    ];
  }, [rows]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Produção MineOPS</h1>
            <p className="text-sm text-muted-foreground">
              Fonte: SQL Server → Agente SSRS → Supabase · atualização a cada 30s
            </p>
          </div>
          <div className="flex items-center gap-2">
            {online ? (
              <Badge className="bg-mining-green/20 text-mining-green border-mining-green/40 gap-1">
                <Radio className="h-3 w-3 animate-pulse" /> ONLINE
              </Badge>
            ) : (
              <Badge className="bg-mining-red/20 text-mining-red border-mining-red/40 gap-1">
                <Radio className="h-3 w-3" /> OFFLINE
              </Badge>
            )}
            <Link to="/monitoramento">
              <Button variant="outline" size="sm">Monitoramento SQL</Button>
            </Link>
          </div>
        </header>

        {/* 4 cards principais */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
                <Database className="h-3 w-3" /> 📊 Produção Total do Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-mining-blue">
                {fmt(Number(latest?.toneladas_total || 0))} <span className="text-base">t</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {latest?.data_referencia ?? "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
                <Gauge className="h-3 w-3" /> ⚡ Produção / Hora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-mining-green">
                {fmt(Number(latest?.producao_hora || 0))} <span className="text-base">t/h</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Última leitura</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" /> 🕒 Última Atualização
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{timeAgo(lastUpdate)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {lastUpdate ? new Date(lastUpdate).toLocaleString("pt-BR") : "sem dados"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
                <Activity className="h-3 w-3" /> 🏭 Turno Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-mining-yellow uppercase">
                {latest?.turno ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Origem: {latest?.relatorio_origem ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">📈 Produção Diária — últimos 30 dias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="data" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0a", border: "1px solid #22c55e", fontSize: 12 }}
                      formatter={(v: number) => [`${fmt(v)} t`, "Toneladas"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="toneladas"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#22c55e" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">📈 Produção por Turno</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={turnoSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="turno" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0a", border: "1px solid #facc15", fontSize: 12 }}
                      formatter={(v: number) => [`${fmt(v)} t`, "Toneladas"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="toneladas" fill="#facc15" radius={[4, 4, 0, 0]} name="Toneladas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}