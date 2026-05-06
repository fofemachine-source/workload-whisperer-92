import * as XLSX from "xlsx";
import { processSheetValues, SheetValues, EquipmentMetrics, TargetEquipment, AreaMetrics, AreaName, MetricColumnMap } from "./excelParser";

export interface LocalExcelResult {
  metrics: Record<TargetEquipment, EquipmentMetrics>;
  areas: Record<AreaName, AreaMetrics>;
  debug: Array<{ sheet: string; headerRow: number; map: MetricColumnMap; matched: number }>;
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

  const { metrics, areas, debug } = processSheetValues(sheets);
  return {
    metrics,
    areas,
    debug,
    fileName: file.name,
    sheetNames: wb.SheetNames,
    parsedAt: new Date().toISOString(),
  };
}

const STORAGE_KEY = "lovable.localExcel.v1";

export function persistLocalExcel(result: LocalExcelResult) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  } catch (e) {
    console.warn("[localExcel] não foi possível salvar no localStorage", e);
  }
}

export function loadPersistedLocalExcel(): LocalExcelResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalExcelResult;
  } catch {
    return null;
  }
}

export function clearPersistedLocalExcel() {
  localStorage.removeItem(STORAGE_KEY);
}