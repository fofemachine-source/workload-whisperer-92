import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import { useExcelWorkbook } from "@/hooks/useExcelWorkbook";
import { useExcelMetrics } from "@/hooks/useExcelMetrics";
import { EquipmentMetrics, TargetEquipment, AreaMetrics, AreaName, AggregateSummary, GenericEquipmentRow } from "@/services/excelParser";
import { DriveItem, WorksheetInfo } from "@/services/graphService";
import {
  parseLocalExcel,
  persistLocalExcel,
  loadPersistedLocalExcel,
  clearPersistedLocalExcel,
  LocalExcelResult,
} from "@/services/localExcelParser";

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
  // Local upload (xlsx) — fonte alternativa, sem OneDrive
  source: "local" | "onedrive" | "none";
  localFile: { name: string; sheetNames: string[]; parsedAt: string } | null;
  localError: string | null;
  localLoading: boolean;
  uploadLocalExcel: (file: File) => Promise<void>;
  clearLocalExcel: () => void;
}

const Ctx = createContext<ExcelLiveValue | null>(null);

export function ExcelLiveProvider({ children }: { children: ReactNode }) {
  const isAuth = useIsAuthenticated();
  const wb = useExcelWorkbook(isAuth);
  const m = useExcelMetrics(wb.file, wb.worksheets);

  const [local, setLocal] = useState<LocalExcelResult | null>(() => loadPersistedLocalExcel());
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const uploadLocalExcel = useCallback(async (file: File) => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const result = await parseLocalExcel(file);
      setLocal(result);
      persistLocalExcel(result);
      console.log("[localExcel] planilha carregada:", result.fileName, result.sheetNames);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLocalError(msg);
      console.error("[localExcel] erro:", msg);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  const clearLocalExcel = useCallback(() => {
    clearPersistedLocalExcel();
    setLocal(null);
    setLocalError(null);
  }, []);

  // Local takes priority if present; otherwise fallback to OneDrive
  const useLocal = !!local;
  const metrics = useLocal ? local!.metrics : m.metrics;
  const areas = useLocal ? local!.areas : m.areas;
  const debug = useLocal ? local!.debug : m.debug;
  const lastUpdated = useLocal ? new Date(local!.parsedAt) : m.lastUpdated;
  const summary = useLocal ? local!.summary ?? null : null;
  const rows = useLocal ? local!.rows ?? [] : [];

  const value: ExcelLiveValue = {
    isAuth,
    file: wb.file,
    worksheets: wb.worksheets,
    workbookLoading: wb.loading,
    workbookError: wb.error,
    metrics,
    areas,
    metricsLoading: useLocal ? localLoading : m.loading,
    metricsError: useLocal ? localError : m.error,
    lastUpdated,
    refresh: useLocal ? async () => {} : m.refresh,
    refreshWorkbook: wb.refresh,
    debug,
    summary,
    rows,
    source: useLocal ? "local" : isAuth ? "onedrive" : "none",
    localFile: local
      ? { name: local.fileName, sheetNames: local.sheetNames, parsedAt: local.parsedAt }
      : null,
    localError,
    localLoading,
    uploadLocalExcel,
    clearLocalExcel,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExcelLive(): ExcelLiveValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useExcelLive must be used inside <ExcelLiveProvider>");
  return v;
}