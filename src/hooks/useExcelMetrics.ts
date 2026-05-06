import { useEffect, useState, useCallback, useRef } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { createGraphClient } from "@/services/graphService";
import { readWorkbookMetrics, EquipmentMetrics, TargetEquipment, TARGET_EQUIPMENT, MetricColumnMap, AreaMetrics, AreaName } from "@/services/excelParser";
import { DriveItem, WorksheetInfo } from "@/services/graphService";

const POLL_MS = 30_000;

export interface ExcelMetricsState {
  loading: boolean;
  error: string | null;
  metrics: Record<TargetEquipment, EquipmentMetrics> | null;
  areas: Record<AreaName, AreaMetrics> | null;
  debug: Array<{ sheet: string; headerRow: number; map: MetricColumnMap; matched: number }>;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useExcelMetrics(file: DriveItem | null, worksheets: WorksheetInfo[]): ExcelMetricsState {
  const { instance, accounts } = useMsal();
  const isAuth = useIsAuthenticated();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<TargetEquipment, EquipmentMetrics> | null>(null);
  const [areas, setAreas] = useState<Record<AreaName, AreaMetrics> | null>(null);
  const [debug, setDebug] = useState<ExcelMetricsState["debug"]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);
  const lastFingerprint = useRef<string>("");

  const load = useCallback(async (force = false) => {
    if (!isAuth || !file || !worksheets.length || accounts.length === 0) return;
    const fingerprint = `${file.id}|${file.lastModifiedDateTime ?? ""}|${worksheets.map((w) => w.id).join(",")}`;
    if (!force && fingerprint === lastFingerprint.current) {
      console.log("[excel] sem alteração detectada, pulando fetch");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const client = createGraphClient(instance, accounts[0]);
      const driveId = file.parentReference?.driveId ?? "";
      const { metrics: m, areas: a, debug: d } = await readWorkbookMetrics(
        client,
        driveId,
        file.id,
        worksheets.map((w) => w.name),
      );
      setMetrics(m);
      setAreas(a);
      setDebug(d);
      setLastUpdated(new Date());
      lastFingerprint.current = fingerprint;
      console.log("[excel] sync:", new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [isAuth, file, worksheets, instance, accounts]);

  useEffect(() => {
    load(true);
    if (timer.current) window.clearInterval(timer.current);
    if (file) {
      timer.current = window.setInterval(() => {
        if (document.visibilityState === "visible") load(false);
      }, POLL_MS);
    }
    const onVis = () => {
      if (document.visibilityState === "visible") load(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, file]);

  return { loading, error, metrics, areas, debug, lastUpdated, refresh: () => load(true) };
}

export { TARGET_EQUIPMENT };