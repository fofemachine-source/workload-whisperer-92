import { useEffect, useState, useCallback, useRef } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { createGraphClient, getUsedRange } from "@/services/graphService";
import {
  processSheetValues,
  EquipmentMetrics,
  TargetEquipment,
  TARGET_EQUIPMENT,
  MetricColumnMap,
  AreaMetrics,
  AreaName,
  AggregateSummary,
  GenericEquipmentRow,
  FleetAggregate,
  SheetValues,
} from "@/services/excelParser";
import { DriveItem, WorksheetInfo } from "@/services/graphService";

const POLL_MS = 30_000;

export interface ExcelMetricsState {
  loading: boolean;
  error: string | null;
  metrics: Record<TargetEquipment, EquipmentMetrics> | null;
  areas: Record<AreaName, AreaMetrics> | null;
  debug: Array<{ sheet: string; headerRow: number; map: MetricColumnMap; matched: number }>;
  lastUpdated: Date | null;
  summary: AggregateSummary | null;
  rows: GenericEquipmentRow[];
  fleets: Record<TargetEquipment, FleetAggregate> | null;
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
  const [summary, setSummary] = useState<AggregateSummary | null>(null);
  const [rows, setRows] = useState<GenericEquipmentRow[]>([]);
  const [fleets, setFleets] = useState<Record<TargetEquipment, FleetAggregate> | null>(null);
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
      const shareId = file.shareId;
      // Fetch all sheet values in parallel, then run the same structured parser
      // used for local uploads (Horimetros / Paradas / PRODUÇÃO EH rules).
      const sheetValues: SheetValues[] = await Promise.all(
        worksheets.map(async (w) => {
          try {
            const r = await getUsedRange(client, driveId, file.id, w.name, shareId);
            return { name: w.name, values: (r?.values ?? []) as unknown[][] };
          } catch (err) {
            console.warn(`[excel] erro ao ler aba ${w.name}`, err);
            return { name: w.name, values: [] as unknown[][] };
          }
        }),
      );
      const parsed = processSheetValues(sheetValues);
      setMetrics(parsed.metrics);
      setAreas(parsed.areas);
      setDebug(parsed.debug);
      setSummary(parsed.summary);
      setRows(parsed.rows);
      setFleets(parsed.fleets);
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
        if (document.visibilityState === "visible") load(true);
      }, POLL_MS);
    }
    const onVis = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, file]);

  return { loading, error, metrics, areas, debug, lastUpdated, summary, rows, fleets, refresh: () => load(true) };
}

export { TARGET_EQUIPMENT };