import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HardHat, Calendar } from "lucide-react";
import { ProductionEntryForm } from "@/components/production/ProductionEntryForm";
import { MicrosoftLoginButton } from "@/components/microsoft/MicrosoftLoginButton";
import { ExcelDiscoveryPanel } from "@/components/microsoft/ExcelDiscoveryPanel";
import { OperationsHeader } from "@/components/dashboard/OperationsHeader";
import { OperationsSections } from "@/components/dashboard/OperationsSections";

export default function Dashboard() {
  const today = new Date();

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,hsl(var(--mining-purple)/0.12),transparent_60%)]">
      <header className="border-b border-mining-purple/20 bg-black/60 backdrop-blur sticky top-0 z-30 px-4 md:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-mining-purple to-mining-purple-glow flex items-center justify-center shadow-[0_0_20px_-5px_hsl(var(--mining-purple))]">
              <HardHat className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-foreground tracking-tight">
                Centro de Controle Operacional
              </h1>
              <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
                Mineração · Frota Pesada · {format(today, "dd MMM yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="hidden md:flex items-center gap-2 bg-black/40 px-3 py-2 rounded-md border border-mining-purple/25">
              <Calendar className="h-3.5 w-3.5 text-mining-purple-glow" />
              <span className="text-xs font-mono text-foreground">{format(today, "EEEE, dd/MM", { locale: ptBR })}</span>
            </div>
            <ProductionEntryForm />
            <MicrosoftLoginButton />
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 space-y-5">
        <OperationsHeader />
        <OperationsSections />
        <ExcelDiscoveryPanel />
      </main>
    </div>
  );
}
