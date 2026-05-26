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
import { isMicrosoftAuthSupported } from "@/lib/browserSupport";

const CLOUD_POLL_MS = 60_000;

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXCEL_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream", // alguns navegadores enviam genérico
  "",
]);
const ALLOWED_EXCEL_EXT = new Set(["xlsx", "xls", "xlsm"]);

function validateExcelUpload(file: File): string | null {
  if (file.size <= 0) return "Arquivo vazio.";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Arquivo muito grande (máx ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB).`;
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXCEL_EXT.has(ext)) {
    return "Extensão não suportada. Envie um arquivo .xlsx, .xls ou .xlsm.";
  }
  if (file.type && !ALLOWED_EXCEL_MIME.has(file.type)) {
    return "Tipo de arquivo não suportado. Envie uma planilha Excel.";
  }
  return null;
}

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
  lastSyncMs: number | null;
  lastSyncAt: Date | null;
}

const Ctx = createContext<ExcelLiveValue | null>(null);

export function ExcelLiveProvider({ children }: { children: ReactNode }) {
  const authSupported = isMicrosoftAuthSupported();
  if (!authSupported) return <ExcelLiveProviderFallback>{children}</ExcelLiveProviderFallback>;

  return <ExcelLiveProviderConnected>{children}</ExcelLiveProviderConnected>;
}

function ExcelLiveProviderConnected({ children }: { children: ReactNode }) {
  const isAuth = useIsAuthenticated();
  const wb = useExcelWorkbook(isAuth);
  const m = useExcelMetrics(wb.file, wb.sheetValues);

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
    const checkLatestCloudSpreadsheet = async (silent = true) => {
      const { data, error } = await supabase
        .from("spreadsheet_uploads")
        .select("*")
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const localTime = local?.parsedAt ? new Date(local.parsedAt).getTime() : 0;
      const cloudTime = new Date(data.uploaded_at).getTime();
      if (cloudTime > localTime) {
        await fetchAndParseFromCloud(data.file_path, data.file_name, data.uploaded_at, silent);
      } else {
        setLastCloudUpload({ fileName: data.file_name, uploadedAt: data.uploaded_at });
      }
    };

    void checkLatestCloudSpreadsheet(true);

    const pollId = window.setInterval(() => {
      void checkLatestCloudSpreadsheet(true);
    }, CLOUD_POLL_MS);

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
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAndParseFromCloud, local?.parsedAt]);

  const uploadLocalExcel = useCallback(async (file: File) => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const validationError = validateExcelUpload(file);
      if (validationError) {
        setLocalError(validationError);
        toast.error("Arquivo rejeitado", { description: validationError });
        return;
      }
      const result = await parseLocalExcel(file);
      setLocal(result);
      persistLocalExcel(result);
      console.log("[localExcel] planilha carregada:", result.fileName, result.sheetNames);

      // Envia para a nuvem para que outros dispositivos recebam via realtime
      setCloudSyncing(true);
      try {
        const ext = (file.name.split(".").pop() || "xlsx").toLowerCase();
        const filePath = `live/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("spreadsheets")
          .upload(filePath, file, {
            upsert: false,
            contentType:
              file.type && ALLOWED_EXCEL_MIME.has(file.type)
                ? file.type
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase
          .from("spreadsheet_uploads")
          .insert({ file_name: file.name, file_path: filePath });
        if (insErr) throw insErr;
        setLastCloudUpload({ fileName: file.name, uploadedAt: result.parsedAt });
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

  // Após login, OneDrive deve ser a fonte principal. Upload/local fica apenas
  // como fallback quando a leitura remota ainda não estiver disponível.
  const oneDriveAvailable = isAuth && !!wb.file && !!m.metrics;
  const localAvailable = !!local;
  const waitingForOneDrive = isAuth && !wb.hasLoadedOnce;
  // Regra operacional: quando o OneDrive estiver disponível ele sempre vence.
  // O cache/upload local serve apenas como fallback temporário enquanto a fonte
  // oficial ainda não terminou de sincronizar.
  const useOneDrive = oneDriveAvailable;
  const useLocal = localAvailable && !useOneDrive && (!isAuth || waitingForOneDrive);
  if (useLocal) {
    console.log(
      "[ExcelLive] fonte ativa: LOCAL",
      local?.fileName,
      "parsedAt=",
      local?.parsedAt,
      isAuth ? "(aguardando OneDrive)" : "",
    );
  } else if (useOneDrive) {
    console.log("[ExcelLive] fonte ativa: ONEDRIVE", wb.file?.name);
  } else if (isAuth) {
    console.log(
      waitingForOneDrive
        ? "[ExcelLive] aguardando OneDrive sincronizar e sem cache local disponível"
        : "[ExcelLive] OneDrive autenticado, mas sem dados válidos da planilha oficial",
    );
  }
  const metrics = useOneDrive ? m.metrics : useLocal ? local!.metrics : null;
  const rawAreas = useOneDrive ? m.areas : useLocal ? local!.areas : null;
  // Override metas operacionais (mai): Mina 1.351.130 / Retaludamento 1.241.297
  const areas: typeof rawAreas = rawAreas
    ? {
        ...rawAreas,
        Mina: {
          ...rawAreas.Mina,
          meta: 1_351_130,
        },
        Retaludamento: {
          ...rawAreas.Retaludamento,
          meta: 1_241_297,
        },
      }
    : null;
  const debug = useOneDrive ? m.debug : useLocal ? local!.debug : [];
  const lastUpdated = useOneDrive ? m.lastUpdated : useLocal ? new Date(local!.parsedAt) : null;
  const rawSummary = useOneDrive ? m.summary : useLocal ? local!.summary ?? null : null;
  // Override metas no summary para refletir as metas operacionais corretas
  const summary = rawSummary
    ? (() => {
        const totalMeta = 1_351_130 + 1_241_297;
        const totalRealizado = rawSummary.totalRealizado ?? 0;
        return {
          ...rawSummary,
          totalMeta,
          aderencia: totalMeta ? (totalRealizado / totalMeta) * 100 : 0,
        };
      })()
    : null;
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
    lastSyncMs: useOneDrive ? wb.lastSyncMs : null,
    lastSyncAt: useOneDrive ? wb.lastSyncAt : useLocal && local ? new Date(local.parsedAt) : null,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function ExcelLiveProviderFallback({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<LocalExcelResult | null>(() => loadPersistedLocalExcel());
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [lastCloudUpload, setLastCloudUpload] = useState<{ fileName: string; uploadedAt: string } | null>(null);

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
    } catch (e) {
      console.error("[cloudSync] erro ao baixar/parsear:", e);
    } finally {
      setCloudSyncing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkLatestCloudSpreadsheet = async (silent = true) => {
      const { data, error } = await supabase
        .from("spreadsheet_uploads")
        .select("*")
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const localTime = local?.parsedAt ? new Date(local.parsedAt).getTime() : 0;
      const cloudTime = new Date(data.uploaded_at).getTime();
      if (cloudTime > localTime) {
        await fetchAndParseFromCloud(data.file_path, data.file_name, data.uploaded_at, silent);
      } else {
        setLastCloudUpload({ fileName: data.file_name, uploadedAt: data.uploaded_at });
      }
    };

    void checkLatestCloudSpreadsheet(true);

    const pollId = window.setInterval(() => {
      void checkLatestCloudSpreadsheet(true);
    }, CLOUD_POLL_MS);

    const channel = supabase
      .channel("spreadsheet-uploads")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "spreadsheet_uploads" },
        (payload) => {
          const row = payload.new as { file_path: string; file_name: string; uploaded_at: string };
          fetchAndParseFromCloud(row.file_path, row.file_name, row.uploaded_at, false);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [fetchAndParseFromCloud, local?.parsedAt]);

  const uploadLocalExcel = useCallback(async (file: File) => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const validationError = validateExcelUpload(file);
      if (validationError) {
        setLocalError(validationError);
        toast.error("Arquivo rejeitado", { description: validationError });
        return;
      }
      const result = await parseLocalExcel(file);
      setLocal(result);
      persistLocalExcel(result);

      setCloudSyncing(true);
      try {
        const ext = (file.name.split(".").pop() || "xlsx").toLowerCase();
        const filePath = `live/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("spreadsheets")
          .upload(filePath, file, {
            upsert: false,
            contentType:
              file.type && ALLOWED_EXCEL_MIME.has(file.type)
                ? file.type
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase
          .from("spreadsheet_uploads")
          .insert({ file_name: file.name, file_path: filePath });
        if (insErr) throw insErr;
        setLastCloudUpload({ fileName: file.name, uploadedAt: result.parsedAt });
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
      setLocalError(msg);
      console.error("[localExcel] erro ao parsear/publicar:", msg);
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

  const value: ExcelLiveValue = {
    isAuth: false,
    file: null,
    worksheets: [],
    workbookLoading: false,
    workbookError: null,
    metrics: local?.metrics ?? null,
    areas: local?.areas
      ? {
          ...local.areas,
          Mina: {
            ...local.areas.Mina,
            meta: 1_351_130,
          },
          Retaludamento: {
            ...local.areas.Retaludamento,
            meta: 1_241_297,
          },
        }
      : null,
    metricsLoading: localLoading,
    metricsError: localError,
    lastUpdated: local ? new Date(local.parsedAt) : null,
    refresh: async () => {},
    refreshWorkbook: async () => {},
    debug: local?.debug ?? [],
    summary: local?.summary
      ? (() => {
          const totalMeta = 1_351_130 + 1_241_297;
          const totalRealizado = local.summary.totalRealizado ?? 0;
          return {
            ...local.summary,
            totalMeta,
            aderencia: totalMeta ? (totalRealizado / totalMeta) * 100 : 0,
          };
        })()
      : null,
    rows: local?.rows ?? [],
    fleets: local?.fleets ?? null,
    source: local ? "local" : "none",
    localFile: local ? { name: local.fileName, sheetNames: local.sheetNames, parsedAt: local.parsedAt } : null,
    localError,
    localLoading,
    uploadLocalExcel,
    clearLocalExcel,
    cloudSyncing,
    lastCloudUpload,
    lastSyncMs: null,
    lastSyncAt: local ? new Date(local.parsedAt) : null,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExcelLive(): ExcelLiveValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useExcelLive must be used inside <ExcelLiveProvider>");
  return v;
}