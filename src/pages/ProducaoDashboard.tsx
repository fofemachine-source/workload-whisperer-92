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
import { useProducaoFrente, useProducaoEquipamento } from "@/hooks/useProducaoKpis";
import ValidacaoHexagonCard from "@/components/diagnostico/ValidacaoHexagonCard";
import MonitorAtualizacao from "@/components/diagnostico/MonitorAtualizacao";
import DiagnosticoRetaludamento from "@/components/diagnostico/DiagnosticoRetaludamento";
import truckImg from "@/assets/truck_bright.png";

// Frota fixa de caminhões agrupada por modelo
const FROTA_CAMINHOES = [
  { modelo: "785", total: 25 },
  { modelo: "777", total: 15 },
];

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
  const { data: frentes } = useProducaoFrente(2);
  const { data: equipamentos } = useProducaoEquipamento(2);
  const rows = producao ?? [];
  // "latest" = registro mais recente que tenha métricas válidas (não a linha vazia recém-criada)
  const latest =
    rows.find(
      (r) =>
        Number(r.toneladas_total || 0) > 0 ||
        r.producao_mina != null ||
        r.meta_diaria != null,
    ) ?? rows[0];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    // Logs de diagnóstico solicitados
    // eslint-disable-next-line no-console
    console.log("[Dashboard] producao_diaria:", {
      total: rows.length,
      ultimo: rows[0],
      latestComMetricas: latest,
      dados: rows,
    });
    // eslint-disable-next-line no-console
    console.log("[Dashboard] producao_frente:", {
      total: frentes?.length ?? 0,
      ultimo: frentes?.[0],
      dados: frentes,
    });
    // eslint-disable-next-line no-console
    console.log("[Dashboard] producao_equipamento:", {
      total: equipamentos?.length ?? 0,
      ultimo: equipamentos?.[0],
      dados: equipamentos,
    });
  }, [rows, frentes, equipamentos, latest]);

  // KPIs derivados da linha mais recente
  const metaDiaria = Number(latest?.meta_diaria || 0);
  const metaMensal = Number(latest?.meta_mensal || 0);
  const projecaoTurno = Number(latest?.projecao_turno || 0);

  // Acumulado do mês: usa o campo enviado pelo agente OU soma local
  const monthKey = (latest?.data_referencia ?? new Date().toISOString().slice(0, 10)).slice(0, 7);
  const acumuladoMes = useMemo(() => {
    if (latest?.acumulado_mes != null) return Number(latest.acumulado_mes);
    return rows
      .filter((r) => (r.data_referencia || "").startsWith(monthKey))
      .reduce((s, r) => s + Number(r.toneladas_total || 0), 0);
  }, [latest, rows, monthKey]);

  // Frentes do turno mais recente presente na própria tabela producao_frente
  const frentesAtuais = useMemo(() => {
    if (!frentes || frentes.length === 0) return [];
    const sorted = [...frentes].sort((a, b) =>
      (b.data_referencia + b.turno).localeCompare(a.data_referencia + a.turno),
    );
    const head = sorted[0];
    return sorted
      .filter(
        (f) => f.data_referencia === head.data_referencia && f.turno === head.turno,
      )
      .filter((f) => /^\s*MINA\s*$/i.test(String(f.frente || "")))
      .sort((a, b) => Number(b.toneladas) - Number(a.toneladas));
  }, [frentes]);

  // Regra temporária: Retaludamento = 0 até definirmos regra correta
  const { producaoMina, producaoRetalud } = useMemo(() => {
    if (frentesAtuais.length === 0) {
      return {
        producaoMina: Number(latest?.producao_mina || latest?.toneladas_total || 0),
        producaoRetalud: 0,
      };
    }
    let mina = 0;
    for (const f of frentesAtuais) {
      const ton = Number(f.toneladas || 0);
      mina += ton;
    }
    return { producaoMina: mina, producaoRetalud: 0 };
  }, [frentesAtuais, latest]);

  // Ranking CR por tonelagem (turno mais recente presente em producao_equipamento, top 10)
  const rankingCR = useMemo(() => {
    if (!equipamentos || equipamentos.length === 0) return [];
    const sorted = [...equipamentos].sort((a, b) =>
      (b.data_referencia + b.turno).localeCompare(a.data_referencia + a.turno),
    );
    const head = sorted[0];
    return sorted
      .filter(
        (e) => e.data_referencia === head.data_referencia && e.turno === head.turno,
      )
      .filter((e) => {
        const code = String(e.equipamento || "").toUpperCase();
        return code.startsWith("CR");
      })
      .sort((a, b) => Number(b.toneladas) - Number(a.toneladas))
      .slice(0, 10);
  }, [equipamentos]);

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
    <div className="min-h-screen bg-background text-foreground p-2 md:p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Produção MineOPS</h1>
            <p className="text-xs text-muted-foreground">
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

        <ValidacaoHexagonCard />
        <MonitorAtualizacao />
        <DiagnosticoRetaludamento />

        {/* 4 cards principais */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-[11px] font-mono uppercase text-muted-foreground flex items-center gap-2">
                <Database className="h-3 w-3" /> 📊 Produção Total do Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-mining-blue">
                {fmt(Number(latest?.toneladas_total || 0))} <span className="text-sm">t</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {latest?.data_referencia
                  ? latest.data_referencia.split("-").reverse().join("/")
                  : "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-[11px] font-mono uppercase text-muted-foreground flex items-center gap-2">
                <Gauge className="h-3 w-3" /> ⚡ Produção / Hora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-mining-green">
                {fmt(Number(latest?.producao_hora || 0))} <span className="text-sm">t/h</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Última leitura</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-[11px] font-mono uppercase text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" /> 🕒 Última Atualização
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{timeAgo(lastUpdate)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {lastUpdate ? new Date(lastUpdate).toLocaleString("pt-BR") : "sem dados"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-[11px] font-mono uppercase text-muted-foreground flex items-center gap-2">
                <Activity className="h-3 w-3" /> 🏭 Turno Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-mining-yellow uppercase">
                {latest?.turno ?? "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Origem: {latest?.relatorio_origem ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* KPIs DE MINERAÇÃO + RANKING EH */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiCard label="⛏️ Produção Mina" value={`${fmt(producaoMina)} t`} accent="text-mining-blue" />
          <KpiCard label="🪨 Produção Retaludamento" value={`${fmt(producaoRetalud)} t`} accent="text-mining-yellow" />
          <KpiCard
            label="📦 Acumulado do Mês"
            value={`${fmt(acumuladoMes)} t`}
            sub={metaMensal > 0 ? `${((acumuladoMes / metaMensal) * 100).toFixed(1)}% da meta` : undefined}
            accent="text-mining-green"
          />
          <KpiCard
            label="🔮 Projeção do Turno"
            value={`${fmt(projecaoTurno)} t`}
            accent="text-mining-green"
          />
          <KpiCard label="🎯 Meta Diária" value={`${fmt(metaDiaria)} t`} accent="text-mining-yellow" />
          <KpiCard label="🎯 Meta Mensal" value={`${fmt(metaMensal)} t`} accent="text-mining-yellow" />

          {/* CAMINHÕES — agrupado por frota/modelo */}
          <Card className="lg:col-span-2 bg-black border-mining-green/40">
            <CardHeader className="pb-1">
              <CardTitle className="text-[11px] font-mono uppercase text-mining-green flex items-center gap-2">
                🚛 Caminhões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {FROTA_CAMINHOES.map((f) => {
                  const ativos = f.total; // sem telemetria de status, ativos = total
                  return (
                    <div key={f.modelo} className="flex items-center gap-3 text-left">
                      <img
                        src={truckImg}
                        alt={`Caminhão ${f.modelo}`}
                        className="h-8 w-auto object-contain"
                        style={{ filter: "drop-shadow(0 0 4px hsl(var(--mining-green)/0.5))" }}
                      />
                      <div className="flex flex-col leading-tight">
                        <span className="font-mono text-mining-green text-sm font-bold tracking-wider">
                          CAMINHÕES {f.modelo}
                        </span>
                        <span className="font-mono text-mining-green/80 text-xs">
                          ({ativos}/{f.total})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PRODUÇÃO POR FRENTE */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">🗺️ Produção por Frente — turno atual</CardTitle>
          </CardHeader>
          <CardContent>
            {frentesAtuais.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem dados de frentes para o turno atual.</p>
            ) : (
              <div className="space-y-1.5">
                {frentesAtuais.map((f) => {
                  const max = frentesAtuais[0].toneladas || 1;
                  const pct = (f.toneladas / max) * 100;
                  return (
                    <div key={f.id} className="flex items-center gap-2">
                      <span className="w-16 font-mono text-xs text-foreground">{f.frente}</span>
                      <div className="flex-1 h-2.5 bg-white/5 rounded overflow-hidden">
                        <div
                          className="h-full bg-mining-blue"
                          style={{ width: `${pct}%`, boxShadow: "0 0 6px hsl(var(--mining-blue))" }}
                        />
                      </div>
                      <span className="w-24 text-right font-mono text-xs text-mining-blue">
                        {fmt(f.toneladas)} t
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráficos */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">📈 Produção Diária — últimos 30 dias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="data" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0a", border: "1px solid #22c55e", fontSize: 11 }}
                      formatter={(v: number) => [`${fmt(v)} t`, "Toneladas"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="toneladas"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 2, fill: "#22c55e" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">📈 Produção por Turno</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={turnoSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="turno" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#0a0a0a", border: "1px solid #facc15", fontSize: 11 }}
                      formatter={(v: number) => [`${fmt(v)} t`, "Toneladas"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
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

function KpiCard({
  label,
  value,
  sub,
  accent = "text-foreground",
  tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  tooltip?: string;
}) {
  return (
    <Card title={tooltip}>
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] font-mono uppercase text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-lg font-bold ${accent}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}