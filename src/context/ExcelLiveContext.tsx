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
  // OneDrive takes priority when authenticated and a workbook was found;
  // local upload acts as manual fallback.
  const useOneDrive = isAuth && !!wb.file && !!m.metrics;
  const useLocal = !useOneDrive && !!local;
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
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExcelLive(): ExcelLiveValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useExcelLive must be used inside <ExcelLiveProvider>");
  return v;
}