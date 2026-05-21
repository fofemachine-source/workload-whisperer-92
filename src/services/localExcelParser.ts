import * as XLSX from "xlsx";
import {
  processSheetValues,
  SheetValues,
  EquipmentMetrics,
  TargetEquipment,
  AreaMetrics,
  AreaName,
  MetricColumnMap,
  AggregateSummary,
  GenericEquipmentRow,
  FleetAggregate,
} from "./excelParser";

export interface LocalExcelResult {
  metrics: Record<TargetEquipment, EquipmentMetrics>;
  areas: Record<AreaName, AreaMetrics>;
  debug: Array<{ sheet: string; headerRow: number; map: MetricColumnMap; matched: number }>;
  rows: GenericEquipmentRow[];
  summary: AggregateSummary;
  primarySheet: string | null;
  fleets: Record<TargetEquipment, FleetAggregate>;
  fileName: string;
  sheetNames: string[];
  parsedAt: string;
}

export async function parseLocalExcel(file: File): Promise<LocalExcelResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheets: SheetValues[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const values = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: false,
    }) as unknown[][];
    return { name, values };
  });

  const { metrics, areas, debug, rows, summary, primarySheet, fleets } = processSheetValues(sheets);

  // Diagnostic logs (temporary)
  console.log("[localExcel] arquivo:", file.name);
  console.log("[localExcel] abas:", wb.SheetNames);
  console.log("[localExcel] aba primária detectada:", primarySheet);
  debug.forEach((d) => {
    const cols = Object.entries(d.map)
      .map(([k, v]) => `${k}=col${v}`)
      .join(", ");
    console.log(`[localExcel] [${d.sheet}] headerRow=${d.headerRow}, linhas=${d.matched}, colunas: ${cols}`);
  });
  console.log("[localExcel] equipamentos detectados:", rows.length, rows.map((r) => `${r.equipamento} (${r.category})`));
  console.log("[localExcel] KPIs calculados:", summary);

  return {
    metrics,
    areas,
    debug,
    rows,
    summary,
    primarySheet,
    fleets,
    fileName: file.name,
    sheetNames: wb.SheetNames,
    parsedAt: new Date().toISOString(),
  };
}

const STORAGE_KEY = "lovable.localExcel.v5";
const LEGACY_KEYS = ["lovable.localExcel.v1", "lovable.localExcel.v2", "lovable.localExcel.v3", "lovable.localExcel.v4"];

export function persistLocalExcel(result: LocalExcelResult) {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  } catch (e) {
    console.warn("[localExcel] não foi possível salvar no localStorage", e);
  }
}

export function loadPersistedLocalExcel(): LocalExcelResult | null {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalExcelResult;
    // Sanity: precisa ter summary com os novos campos
    if (!parsed?.summary || typeof parsed.summary.acumuladoDia === "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedLocalExcel() {
  localStorage.removeItem(STORAGE_KEY);
}