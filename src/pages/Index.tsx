import { ExcelDiscoveryPanel } from "@/components/microsoft/ExcelDiscoveryPanel";
import { CommandTopBar } from "@/components/dashboard/CommandTopBar";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { OperationsCharts } from "@/components/dashboard/OperationsCharts";

export default function Dashboard() {
  return (
    <div className="min-h-screen ops-grid-bg">
      <CommandTopBar />
      <main className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
        <KpiStrip />
        <OperationsCharts />
        <ExcelDiscoveryPanel />
      </main>
    </div>
  );
}
