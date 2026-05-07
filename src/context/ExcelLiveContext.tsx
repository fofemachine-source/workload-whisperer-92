import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import { useExcelWorkbook } from "@/hooks/useExcelWorkbook";
import { useExcelMetrics } from "@/hooks/useExcelMetrics";
import { EquipmentMetrics, TargetEquipment, AreaMetrics, AreaName, AggregateSummary, GenericEquipmentRow, FleetAggregate } from "@/services/excelParser";
import { DriveItem, WorksheetInfo } from "@/services/graphService";
import {
  parseLocalExcel,
  persistLocalExcel,
  loadPersistedLocalExcel,
  clearPersistedLocalExcel,
  LocalExcelResult,
} from "@/services/localExcelParser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExcelLiveValue {
  isAuth: boolean;
  file: DriveItem | null;
  worksheets: WorksheetInfo[];
  workbookLoading: boolean;
  workbookError: string | null;
  metrics: Record<TargetEquipment, EquipmentMetrics> | null;
  areas: Record<AreaName, AreaMetrics> | null;
  metricsLoading: boolean;
  metricsError: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  refreshWorkbook: () => Promise<void>;
  debug: ReturnType<typeof useExcelMetrics>["debug"];
  summary: AggregateSummary | null;
  rows: GenericEquipmentRow[];
  fleets: Record<TargetEquipment, FleetAggregate> | null;
  // Local upload (xlsx) — fonte alternativa, sem OneDrive
  source: "local" | "onedrive" | "none";
  localFile: { name: string; sheetNames: string[]; parsedAt: string } | null;
  localError: string | null;
  localLoading: boolean;
  uploadLocalExcel: (file: File) => Promise<void>;
  clearLocalExcel: () => void;
  cloudSyncing: boolean;
  lastCloudUpload: { fileName: string; uploadedAt: string } | null;
}

const Ctx = createContext<ExcelLiveValue | null>(null);

export function ExcelLiveProvider({ children }: { children: ReactNode }) {
  const isAuth = useIsAuthenticated();
  const wb = useExcelWorkbook(isAuth);
  const m = useExcelMetrics(wb.file, wb.worksheets);

  const [local, setLocal] = useState<LocalExcelResult | null>(() => loadPersistedLocalExcel());
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [lastCloudUpload, setLastCloudUpload] = useState<{ fileName: string; uploadedAt: string } | null>(null);

  // Download e processa planilha do storage
  const fetchAndParseFromCloud = useCallback(async (filePath: string, fileName: string, uploadedAt: string, silent = false) => {
    setCloudSyncing(true);
    try {
      const { data, error } = await supabase.storage.from("spreadsheets").download(filePath);
      if (error || !data) throw error ?? new Error("Falha no download");
      const file = new File([data], fileName, { type: data.type });
      const result = await parseLocalExcel(file);
      setLocal(result);
      persistLocalExcel(result);
      setLastCloudUpload({ fileName, uploadedAt });
      if (!silent) {
        toast.success("Planilha sincronizada", { description: `${fileName} · ${new Date(uploadedAt).toLocaleTimeString("pt-BR")}` });
      }
      console.log("[cloudSync] planilha aplicada:", fileName);
    } catch (e) {
      console.error("[cloudSync] erro ao baixar/parsear:", e);
    } finally {
      setCloudSyncing(false);
    }
  }, []);

  // Carrega a planilha mais recente da nuvem ao abrir + assina realtime
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("spreadsheet_uploads")
        .select("*")
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error || !data) return;
      // Só baixa se for mais nova que a local persistida
      const localTime = local?.parsedAt ? new Date(local.parsedAt).getTime() : 0;
      const cloudTime = new Date(data.uploaded_at).getTime();
      if (cloudTime > localTime) {
        await fetchAndParseFromCloud(data.file_path, data.file_name, data.uploaded_at, true);
      } else {
        setLastCloudUpload({ fileName: data.file_name, uploadedAt: data.uploaded_at });
      }
    })();

    const channel = supabase
      .channel("spreadsheet-uploads")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "spreadsheet_uploads" },
        (payload) => {
          const row = payload.new as { file_path: string; file_name: string; uploaded_at: string };
          console.log("[cloudSync] novo upload detectado:", row.file_name);
          fetchAndParseFromCloud(row.file_path, row.file_name, row.uploaded_at, false);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadLocalExcel = useCallback(async (file: File) => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const result = await parseLocalExcel(file);
      setLocal(result);
      persistLocalExcel(result);
      console.log("[localExcel] planilha carregada:", result.fileName, result.sheetNames);

      // Envia para a nuvem para que outros dispositivos recebam via realtime
      setCloudSyncing(true);
      try {
        const ext = file.name.split(".").pop() || "xlsx";
        const filePath = `live/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("spreadsheets")
          .upload(filePath, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase
          .from("spreadsheet_uploads")
          .insert({ file_name: file.name, file_path: filePath });
        if (insErr) throw insErr;
        console.log("[cloudSync] planilha enviada para a nuvem:", filePath);
        toast.success("Planilha publicada para todos os painéis", { description: file.name });
      } catch (cloudErr) {
        console.error("[cloudSync] erro ao publicar:", cloudErr);
        toast.error("Falha ao publicar na nuvem", {
          description: cloudErr instanceof Error ? cloudErr.message : String(cloudErr),
        });
      } finally {
        setCloudSyncing(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error ? e.stack : undefined;
      setLocalError(msg);
      console.error("[localExcel] erro ao parsear/publicar:", msg, stack);
      toast.error("Erro ao processar planilha", { description: msg });
    } finally {
      setLocalLoading(false);
    }
  }, []);

  const clearLocalExcel = useCallback(() => {
    clearPersistedLocalExcel();
    setLocal(null);
    setLocalError(null);
  }, []);

  // A fonte mais RECENTE vence. Upload local sempre sobrescreve OneDrive
  // se for mais novo (e vice-versa). Isso garante que, ao subir uma planilha
  // manualmente, os indicadores atualizem mesmo com login MS ativo.
  const oneDriveTime = m.lastUpdated ? m.lastUpdated.getTime() : 0;
  const localTime = local?.parsedAt ? new Date(local.parsedAt).getTime() : 0;
  const oneDriveAvailable = isAuth && !!wb.file && !!m.metrics;
  const localAvailable = !!local;
  const useLocal = localAvailable && (!oneDriveAvailable || localTime >= oneDriveTime);
  const useOneDrive = !useLocal && oneDriveAvailable;
  if (useLocal) {
    console.log("[ExcelLive] fonte ativa: LOCAL", local?.fileName, "parsedAt=", local?.parsedAt);
  } else if (useOneDrive) {
    console.log("[ExcelLive] fonte ativa: ONEDRIVE", wb.file?.name);
  }
  const metrics = useOneDrive ? m.metrics : useLocal ? local!.metrics : null;
  const areas = useOneDrive ? m.areas : useLocal ? local!.areas : null;
  const debug = useOneDrive ? m.debug : useLocal ? local!.debug : [];
  const lastUpdated = useOneDrive ? m.lastUpdated : useLocal ? new Date(local!.parsedAt) : null;
  const summary = useOneDrive ? m.summary : useLocal ? local!.summary ?? null : null;
  const rows = useOneDrive ? m.rows : useLocal ? local!.rows ?? [] : [];
  const fleets = useOneDrive ? m.fleets : useLocal ? local!.fleets ?? null : null;

  const value: ExcelLiveValue = {
    isAuth,
    file: wb.file,
    worksheets: wb.worksheets,
    workbookLoading: wb.loading,
    workbookError: wb.error,
    metrics,
    areas,
    metricsLoading: useOneDrive ? m.loading : useLocal ? localLoading : false,
    metricsError: useOneDrive ? m.error : useLocal ? localError : null,
    lastUpdated,
    refresh: useOneDrive ? m.refresh : async () => {},
    refreshWorkbook: wb.refresh,
    debug,
    summary,
    rows,
    fleets,
    source: useOneDrive ? "onedrive" : useLocal ? "local" : "none",
    localFile: local
      ? { name: local.fileName, sheetNames: local.sheetNames, parsedAt: local.parsedAt }
      : null,
    localError,
    localLoading,
    uploadLocalExcel,
    clearLocalExcel,
    cloudSyncing,
    lastCloudUpload,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExcelLive(): ExcelLiveValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useExcelLive must be used inside <ExcelLiveProvider>");
  return v;
}