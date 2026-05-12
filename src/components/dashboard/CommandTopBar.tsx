import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Loader2, HardHat, Calendar, RefreshCw, Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExcelLive } from "@/context/ExcelLiveContext";
import { ExcelUploadButton } from "@/components/dashboard/ExcelUploadButton";
import { MicrosoftLoginButton } from "@/components/microsoft/MicrosoftLoginButton";
import { toast } from "sonner";

export function CommandTopBar() {
  const { lastUpdated, metricsLoading, workbookLoading, source, localFile, refresh, refreshWorkbook, debug, file, worksheets, cloudSyncing, lastCloudUpload, lastSyncMs, lastSyncAt } = useExcelLive();
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const loading = metricsLoading || workbookLoading;
  const [refreshCount, setRefreshCount] = useState(0);
  const lastSeenRef = useRef<number | null>(null);

  // Conta sempre que um novo lastUpdated chega (auto a cada 30s ou manual)
  useEffect(() => {
    if (!lastUpdated) return;
    const t = lastUpdated.getTime();
    if (lastSeenRef.current !== t) {
      lastSeenRef.current = t;
      setRefreshCount((c) => c + 1);
    }
  }, [lastUpdated]);

  const status = source === "none" ? "off" : "online";
  const statusLabel =
    source === "onedrive" ? "ONEDRIVE CONECTADO" : source === "local" ? "PLANILHA CARREGADA" : "AGUARDANDO PLANILHA";
  const statusCls =
    status === "online"
      ? "border-mining-green/30 bg-mining-green/5 text-mining-green"
      : "border-mining-red/30 bg-mining-red/5 text-mining-red";
  const dotCls = status === "online" ? "bg-mining-green" : "bg-mining-red";

  const handleRefresh = async () => {
    const before = lastUpdated?.getTime() ?? 0;
    toast.loading("Recarregando dados...", { id: "refresh" });
    try {
      await Promise.all([refreshWorkbook(), refresh()]);
      const sheetsProcessed = debug?.filter((d) => d.matched > 0).map((d) => d.sheet).join(", ") || "—";
      toast.success(`Dados atualizados às ${new Date().toLocaleTimeString("pt-BR")}`, {
        id: "refresh",
        description: source === "onedrive" ? `Abas processadas: ${sheetsProcessed}` : source === "local" ? `Planilha: ${localFile?.name}` : "Sem fonte conectada",
      });
    } catch (e) {
      toast.error("Falha ao atualizar", { id: "refresh", description: e instanceof Error ? e.message : String(e) });
    }
  };

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
              Frota Pesada · Upload Manual de Planilha
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

          {loading && <Loader2 className="h-4 w-4 animate-spin text-mining-blue-glow" />}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-2 border-mining-green/40 text-mining-green hover:bg-mining-green/10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar agora
          </Button>
          <MicrosoftLoginButton />
          <ExcelUploadButton />
        </div>
      </div>

      <div className="px-4 md:px-6 pb-2 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 text-mining-green" />
        <span>
          {source === "onedrive"
            ? "FONTE: ONEDRIVE · auto a cada 1 min"
            : source === "local"
            ? "FONTE: PLANILHA LOCAL (fallback)"
            : "AGUARDANDO SINCRONIZAÇÃO DO ONEDRIVE"}
        </span>
        {lastSyncAt && (
          <>
            <span className="text-mining-blue/40">·</span>
            <span className="text-mining-cyan">
              SYNC: {lastSyncAt.toLocaleTimeString("pt-BR")}
              {lastSyncMs !== null && (
                <span className="text-mining-yellow"> ({lastSyncMs < 1000 ? `${lastSyncMs}ms` : `${(lastSyncMs / 1000).toFixed(2)}s`})</span>
              )}
            </span>
          </>
        )}
        <span className="text-mining-blue/40">·</span>
        {cloudSyncing ? (
          <span className="flex items-center gap-1 text-mining-yellow">
            <Loader2 className="h-3 w-3 animate-spin" /> SINCRONIZANDO NUVEM…
          </span>
        ) : lastCloudUpload ? (
          <span className="flex items-center gap-1 text-mining-green">
            <Cloud className="h-3 w-3" /> NUVEM AO VIVO · {lastCloudUpload.fileName} · {new Date(lastCloudUpload.uploadedAt).toLocaleTimeString("pt-BR")}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <CloudOff className="h-3 w-3" /> NUVEM: AGUARDANDO 1º UPLOAD
          </span>
        )}
        <span className="text-mining-blue/40">·</span>
        <span>{format(new Date(), "EEEE, dd MMM yyyy", { locale: ptBR })}</span>
        {lastUpdated && (
          <>
            <span className="text-mining-blue/40">·</span>
            <span className="text-mining-green">
              ÚLTIMO REFRESH: {lastUpdated.toLocaleTimeString("pt-BR")}
            </span>
            <span className="text-mining-blue/40">·</span>
            <span className="text-mining-yellow">CICLOS: {refreshCount}</span>
          </>
        )}
        {source === "onedrive" && file && (
          <>
            <span className="text-mining-blue/40">·</span>
            <span className="truncate max-w-[35vw]">
              📊 {file.name} · {worksheets.length} aba(s)
              {debug && debug.length > 0 && (
                <> · processadas: {debug.filter((d) => d.matched > 0).map((d) => d.sheet).join(", ") || "—"}</>
              )}
            </span>
          </>
        )}
        {source === "local" && localFile && (
          <>
            <span className="text-mining-blue/40">·</span>
            <span className="truncate max-w-[40vw]">📄 {localFile.name} · {localFile.sheetNames.length} aba(s)</span>
          </>
        )}
      </div>
    </header>
  );
}