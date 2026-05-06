import { useMemo, useState } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Truck, HardHat, Drill, Activity, Calendar, BarChart3, AlertTriangle } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ProductionChart } from "@/components/dashboard/ProductionChart";
import { EquipmentStatusChart } from "@/components/dashboard/EquipmentStatusChart";
import { ProductionEntryForm } from "@/components/production/ProductionEntryForm";
import { MicrosoftLoginButton } from "@/components/microsoft/MicrosoftLoginButton";
import { ExcelDiscoveryPanel } from "@/components/microsoft/ExcelDiscoveryPanel";
import { useEquipment, useDailyProduction, usePlannedProduction, useOccurrences } from "@/hooks/use-mining-data";

// Demo data for initial display when DB is empty
const generateDemoData = () => {
  const today = new Date();
  const days = Array.from({ length: 15 }, (_, i) => {
    const d = subDays(today, 14 - i);
    return {
      label: format(d, "dd/MM"),
      realizado: Math.round(8000 + Math.random() * 4000),
      planejado: 10000,
    };
  });
  return days;
};

export default function Dashboard() {
  const [period] = useState(() => {
    const now = new Date();
    return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
  });

  const { data: equipment } = useEquipment();
  const { data: production } = useDailyProduction(period.from, period.to);
  const { data: planned } = usePlannedProduction(period.from, period.to);
  const { data: occurrences } = useOccurrences("aberto");

  const stats = useMemo(() => {
    const totalCR = equipment?.filter((e) => e.type === "CR").length ?? 0;
    const totalEH = equipment?.filter((e) => e.type === "EH").length ?? 0;
    const totalPF = equipment?.filter((e) => e.type === "PF").length ?? 0;
    const openOccurrences = occurrences?.length ?? 0;

    const totalTons = production?.reduce((s, p) => s + (p.tons_produced ?? 0), 0) ?? 0;
    const totalHoursWorked = production?.reduce((s, p) => s + (p.hours_worked ?? 0), 0) ?? 0;
    const totalHoursStopped = production?.reduce((s, p) => s + (p.hours_stopped ?? 0), 0) ?? 0;
    const totalHours = totalHoursWorked + totalHoursStopped;

    const productivity = totalHoursWorked > 0 ? totalTons / totalHoursWorked : 0;
    const utilization = totalHours > 0 ? (totalHoursWorked / totalHours) * 100 : 0;
    const df = totalCR > 0 ? ((totalCR - openOccurrences) / totalCR) * 100 : 100;

    const plannedTons = planned?.reduce((s, p) => s + (p.planned_tons ?? 0), 0) ?? 0;
    const adherence = plannedTons > 0 ? (totalTons / plannedTons) * 100 : 0;

    return { totalCR, totalEH, totalPF, totalTons, productivity, utilization, df, adherence, openOccurrences, plannedTons };
  }, [equipment, production, planned, occurrences]);

  const chartData = useMemo(() => {
    if (!production?.length) return generateDemoData();

    const byDate = new Map<string, number>();
    production.forEach((p) => {
      const key = p.date;
      byDate.set(key, (byDate.get(key) ?? 0) + (p.tons_produced ?? 0));
    });

    const plannedByDate = new Map<string, number>();
    planned?.forEach((p) => {
      const key = p.date;
      plannedByDate.set(key, (plannedByDate.get(key) ?? 0) + (p.planned_tons ?? 0));
    });

    const dates = [...new Set([...byDate.keys(), ...plannedByDate.keys()])].sort();
    return dates.map((d) => ({
      label: format(new Date(d + "T12:00:00"), "dd/MM"),
      realizado: Math.round(byDate.get(d) ?? 0),
      planejado: Math.round(plannedByDate.get(d) ?? 10000),
    }));
  }, [production, planned]);

  const equipmentStatusData = [
    { name: "Operando", value: stats.totalCR - stats.openOccurrences, color: "hsl(142 71% 45%)" },
    { name: "Manutenção", value: stats.openOccurrences, color: "hsl(0 84% 60%)" },
    { name: "Stand By", value: Math.max(0, Math.floor(stats.totalCR * 0.1)), color: "hsl(45 93% 56%)" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-mining-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <HardHat className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Controle de Operações</h1>
              <p className="text-xs text-muted-foreground">
                Dashboard de Produção — {format(new Date(), "MMMM yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-card px-3 py-2 rounded-lg border border-border">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-mono text-foreground">
                {format(new Date(period.from), "dd/MM")} — {format(new Date(period.to), "dd/MM/yyyy")}
              </span>
            </div>
            <ProductionEntryForm />
            <MicrosoftLoginButton />
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-mining-green/10 border border-mining-green/20">
              <div className="w-2 h-2 rounded-full bg-mining-green animate-pulse-glow" />
              <span className="text-xs font-medium text-mining-green">Sistema Ativo</span>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Microsoft Excel integration */}
        <ExcelDiscoveryPanel />

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <KpiCard label="Produtividade" value={stats.productivity.toFixed(1)} unit="t/h" borderColor="indigo" trend="up" trendValue="vs mês ant." />
          <KpiCard label="Utilização" value={stats.utilization.toFixed(1)} unit="%" borderColor="green" />
          <KpiCard label="Disp. Física" value={stats.df.toFixed(1)} unit="%" borderColor="yellow" />
          <KpiCard label="Frota CR" value={stats.totalCR} borderColor="blue" />
          <KpiCard label="Escavadeiras" value={stats.totalEH} borderColor="green" />
          <KpiCard label="Perfuratrizes" value={stats.totalPF} borderColor="indigo" />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-mining-green" />
              <span className="text-sm font-semibold text-foreground">Produção Total</span>
            </div>
            <p className="text-3xl font-bold font-mono text-foreground">
              {stats.totalTons > 0 ? stats.totalTons.toLocaleString("pt-BR") : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Meta: {stats.plannedTons > 0 ? stats.plannedTons.toLocaleString("pt-BR") : "—"} t
            </p>
          </div>
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-mining-yellow" />
              <span className="text-sm font-semibold text-foreground">Aderência</span>
            </div>
            <p className="text-3xl font-bold font-mono text-foreground">
              {stats.adherence > 0 ? stats.adherence.toFixed(1) + "%" : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Realizado vs Planejado</p>
          </div>
          <div className="bg-card rounded-lg p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-mining-red" />
              <span className="text-sm font-semibold text-foreground">Ocorrências Abertas</span>
            </div>
            <p className="text-3xl font-bold font-mono text-foreground">{stats.openOccurrences}</p>
            <p className="text-xs text-muted-foreground mt-1">Manutenção + Paradas</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ProductionChart data={chartData} title="📊 Produção Diária — Planejado vs Realizado" />
          </div>
          <EquipmentStatusChart data={equipmentStatusData} title="🚜 Status da Frota" />
        </div>

        {/* Equipment table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Equipamentos Cadastrados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-mining-surface">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Código</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Capacidade</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {equipment?.slice(0, 12).map((eq) => (
                  <tr key={eq.id} className="border-b border-border/50 hover:bg-mining-card-hover transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">{eq.code}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        eq.type === "CR" ? "bg-mining-blue/15 text-mining-blue" :
                        eq.type === "EH" ? "bg-mining-green/15 text-mining-green" :
                        "bg-mining-indigo/15 text-mining-indigo"
                      }`}>
                        {eq.type === "CR" && <Truck className="h-3 w-3" />}
                        {eq.type === "EH" && <HardHat className="h-3 w-3" />}
                        {eq.type === "PF" && <Drill className="h-3 w-3" />}
                        {eq.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {eq.capacity_tons ? `${eq.capacity_tons}t` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-mining-green" />
                        <span className="text-mining-green font-medium">Ativo</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {equipment && equipment.length > 12 && (
            <div className="px-5 py-3 border-t border-border text-center">
              <span className="text-xs text-muted-foreground">
                Mostrando 12 de {equipment.length} equipamentos
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
