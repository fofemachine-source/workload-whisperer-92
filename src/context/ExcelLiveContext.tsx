import { createContext, useContext, ReactNode } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import { useExcelWorkbook } from "@/hooks/useExcelWorkbook";
import { useExcelMetrics } from "@/hooks/useExcelMetrics";
import { EquipmentMetrics, TargetEquipment, AreaMetrics, AreaName } from "@/services/excelParser";
import { DriveItem, WorksheetInfo } from "@/services/graphService";

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
}

const Ctx = createContext<ExcelLiveValue | null>(null);

export function ExcelLiveProvider({ children }: { children: ReactNode }) {
  const isAuth = useIsAuthenticated();
  const wb = useExcelWorkbook(isAuth);
  const m = useExcelMetrics(wb.file, wb.worksheets);

  const value: ExcelLiveValue = {
    isAuth,
    file: wb.file,
    worksheets: wb.worksheets,
    workbookLoading: wb.loading,
    workbookError: wb.error,
    metrics: m.metrics,
    areas: m.areas,
    metricsLoading: m.loading,
    metricsError: m.error,
    lastUpdated: m.lastUpdated,
    refresh: m.refresh,
    refreshWorkbook: wb.refresh,
    debug: m.debug,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExcelLive(): ExcelLiveValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useExcelLive must be used inside <ExcelLiveProvider>");
  return v;
}