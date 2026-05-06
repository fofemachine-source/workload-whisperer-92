import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, RefreshCw, Cloud, CheckCircle2, Loader2, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExcelLive } from "@/context/ExcelLiveContext";
import { MicrosoftLoginButton } from "@/components/microsoft/MicrosoftLoginButton";

export function CommandTopBar() {
  const { file, isAuth, lastUpdated, refresh, refreshWorkbook, metricsLoading, workbookLoading } = useExcelLive();
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const loading = metricsLoading || workbookLoading;

  const status = isAuth && file ? "online" : isAuth ? "warn" : "off";
  const statusLabel = status === "online" ? "ONLINE" : status === "warn" ? "AGUARDANDO ARQUIVO" : "OFFLINE";
  const statusCls =
    status === "online"
      ? "border-mining-green/30 bg-mining-green/5 text-mining-green"
      : status === "warn"
      ? "border-mining-yellow/30 bg-mining-yellow/5 text-mining-yellow"
      : "border-mining-red/30 bg-mining-red/5 text-mining-red";
  const dotCls =
    status === "online" ? "bg-mining-green" : status === "warn" ? "bg-mining-yellow" : "bg-mining-red";

  return (
    <header className="sticky top-0 z-30 ops-card !rounded-none !border-x-0 !border-t-0 border-b border-mining-blue/15 bg-mining-surface/85 backdrop-blur-xl">
      <div className="px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-mining-blue to-mining-cyan flex items-center justify-center shadow-[0_0_24px_-4px_hsl(var(--mining-blue))]">
            <HardHat className="h-5 w-5 text-background" />
            <span className="absolute -inset-0.5 rounded-xl border border-mining-blue/40 animate-pulse-glow" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold tracking-tight text-foreground">
              Centro de Operações · Mineração
            </h1>
            <p className="text-[10px] md:text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              Frota Pesada · Tempo Real · OneDrive
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="hidden md:flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-mining-blue/20 text-xs font-mono">
            <Calendar className="h-3.5 w-3.5 text-mining-blue-glow" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent outline-none text-foreground [color-scheme:dark]"
            />
          </label>

          <div className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border ${statusCls}`}>
            <span className="relative flex h-2 w-2">
              <span className={`absolute inset-0 rounded-full ${dotCls} animate-ping opacity-75`} />
              <span className={`relative h-2 w-2 rounded-full ${dotCls}`} />
            </span>
            <span className="text-[10px] font-mono font-bold tracking-wider">
              SISTEMA {statusLabel}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { refreshWorkbook(); refresh(); }}
            disabled={loading}
            className="gap-2 border-mining-blue/30 bg-mining-blue/5 hover:bg-mining-blue/15 text-mining-blue-glow"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Sincronizar OneDrive</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="gap-2 border-mining-green/30 bg-mining-green/5 hover:bg-mining-green/15 text-mining-green-glow"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>

          <MicrosoftLoginButton />
        </div>
      </div>

      <div className="px-4 md:px-6 pb-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 text-mining-green" />
        <span>POLLING 30s</span>
        <span className="text-mining-blue/40">·</span>
        <span>{format(new Date(), "EEEE, dd MMM yyyy", { locale: ptBR })}</span>
        {lastUpdated && (
          <>
            <span className="text-mining-blue/40">·</span>
            <span>SYNC {lastUpdated.toLocaleTimeString("pt-BR")}</span>
          </>
        )}
        {file && (
          <>
            <span className="text-mining-blue/40">·</span>
            <span className="truncate max-w-[40vw]">📄 {file.name}</span>
          </>
        )}
      </div>
    </header>
  );
}