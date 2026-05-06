import { Client } from "@microsoft/microsoft-graph-client";
import { getUsedRange } from "./graphService";

export const TARGET_EQUIPMENT = ["EX1200", "EX2500", "Komatsu 730", "Komatsu 785"] as const;
export type TargetEquipment = (typeof TARGET_EQUIPMENT)[number];

export interface MetricColumnMap {
  equipamento?: number;
  horasTrabalhadas?: number;
  producao?: number;
  produtividade?: number;
  manutencao?: number;
  preventiva?: number;
  df?: number;
  ut?: number;
  meta?: number;
  realizado?: number;
  projecao?: number;
  percentual?: number;
}

export interface EquipmentMetrics {
  equipamento: string;
  horasTrabalhadas: number;
  producao: number;
  produtividade: number;
  manutencao: number;
  preventiva: number;
  df: number;
  ut: number;
  source: string;
}

export type AreaName = "Mina" | "Retaludamento";
export interface AreaMetrics {
  area: AreaName;
  meta: number;
  realizado: number;
  projecao: number;
  percentual: number;
  source: string;
}

export interface AggregateSummary {
  produtividade: number;
  ut: number;
  df: number;
  manutencao: number;
  preventiva: number;
  totalProducao: number;
  totalMeta: number;
  totalRealizado: number;
  aderencia: number;
  rowsProcessed: number;
  equipmentCount: number;
  escavadeirasCount: number;
  perfuratrizesCount: number;
  frotaCrCount: number;
}

export interface GenericEquipmentRow {
  equipamento: string;
  category: "escavadeira" | "perfuratriz" | "caminhao" | "outro";
  horasTrabalhadas: number;
  producao: number;
  produtividade: number;
  manutencao: number;
  preventiva: number;
  df: number;
  ut: number;
  source: string;
}

const norm = (s: unknown): string =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const HEADER_PATTERNS: Record<keyof MetricColumnMap, RegExp[]> = {
  equipamento: [/equipamento/, /^equip\b/, /frota/, /maquina/, /m[aá]quina/, /modelo/, /\barea\b/, /local/, /^tag\b/, /^id\b/, /descri[cç][aã]o/, /^nome\b/],
  horasTrabalhadas: [/horas?\s*trabalhad/, /h\s*trab/, /horimetro/, /^ht\b/],
  producao: [/produ[cç][aã]o(?!t)/, /tonelagem/, /toneladas?/, /^prod\b/, /\bton\b/, /movimentado/, /carregad/],
  produtividade: [/produtividade/, /t\s*\/\s*h/, /ton\/h/, /\bprod\.?\s*$/],
  manutencao: [/manuten[cç]ao(?!.*prev)/, /corretiv/, /\bmanut\b/],
  preventiva: [/preventiva/, /\bprev\b/],
  df: [/\bdf\b/, /disp(onibilidade)?\.?\s*f[ií]sica/, /disp\.?\s*f/, /dispon[ií]vel/],
  ut: [/\but\b/, /utiliza[cç][aã]o/, /uso\s*(da)?\s*frota/, /\butili?z/],
  meta: [/\bmeta\b/, /planejad/, /previsto/],
  realizado: [/realizad/, /\bexecutad/],
  projecao: [/proje[cç][aã]o/, /forecast/, /esperad/],
  percentual: [/^%$/, /percentual/, /aderencia/, /\batg\b/],
};

function detectHeaderRow(values: unknown[][]): { row: number; map: MetricColumnMap } {
  let best = { row: -1, map: {} as MetricColumnMap, score: 0 };
  const limit = Math.min(values.length, 25);
  for (let r = 0; r < limit; r++) {
    const row = values[r] ?? [];
    const map: MetricColumnMap = {};
    let score = 0;
    for (let c = 0; c < row.length; c++) {
      const cell = norm(row[c]);
      if (!cell) continue;
      for (const key of Object.keys(HEADER_PATTERNS) as (keyof MetricColumnMap)[]) {
        if (map[key] !== undefined) continue;
        if (HEADER_PATTERNS[key].some((re) => re.test(cell))) {
          map[key] = c;
          score++;
          break;
        }
      }
    }
    if (score > best.score) best = { row: r, map, score };
  }
  return { row: best.row, map: best.map };
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const s = String(v).replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function matchEquipment(label: string): TargetEquipment | null {
  const n = norm(label);
  if (!n) return null;
  if (/ex\W*1200/.test(n)) return "EX1200";
  if (/ex\W*2500/.test(n)) return "EX2500";
  if (/komatsu.*730|hd\W*730|\b730\b/.test(n)) return "Komatsu 730";
  if (/komatsu.*785|hd\W*785|\b785\b/.test(n)) return "Komatsu 785";
  return null;
}

function classifyEquipment(label: string): GenericEquipmentRow["category"] {
  const n = norm(label);
  if (/^eh[-\s]?\d/.test(n)) return "escavadeira";
  if (/^cr[-\s]?\d/.test(n)) return "caminhao";
  if (/^pf[-\s]?\d|^pp[-\s]?\d|perfurat|drill|sondagem|broca/.test(n)) return "perfuratriz";
  if (/escavadeir|excavator|\bex\W*\d|pa\s*carregadeira|p[aá]\s*mec|hitachi/.test(n)) return "escavadeira";
  if (/caminh[aã]o|truck|hd\W*\d|komatsu|cat\s*\d{3}|off.?road|\bcr\b/.test(n)) return "caminhao";
  return "outro";
}

function looksLikeEquipmentLabel(label: string): boolean {
  const n = norm(label);
  if (!n || n.length < 2 || n.length > 60) return false;
  if (/^total|^m[eé]dia|^geral|^subtotal|^soma|^informa[cç]/.test(n)) return false;
  if (/^#ref|^#n\/?a|^#valor/.test(n)) return false;
  if (/^\d+([.,]\d+)?$/.test(n)) return false;
  return /[a-z]/.test(n);
}

function matchArea(label: string): AreaName | null {
  const n = norm(label);
  if (!n) return null;
  if (/retalud/.test(n)) return "Retaludamento";
  if (/(^|\s)mina(\s|$)/.test(n)) return "Mina";
  return null;
}

export async function readWorkbookMetrics(
  client: Client,
  driveId: string,
  itemId: string,
  worksheetNames: string[],
): Promise<{
  metrics: Record<TargetEquipment, EquipmentMetrics>;
  areas: Record<AreaName, AreaMetrics>;
  debug: Array<{ sheet: string; headerRow: number; map: MetricColumnMap; matched: number }>;
}> {
  const acc: Record<string, EquipmentMetrics> = {};
  TARGET_EQUIPMENT.forEach((eq) => {
    acc[eq] = {
      equipamento: eq,
      horasTrabalhadas: 0,
      producao: 0,
      produtividade: 0,
      manutencao: 0,
      preventiva: 0,
      df: 0,
      ut: 0,
      source: "",
    };
  });

  const areas: Record<AreaName, AreaMetrics> = {
    Mina: { area: "Mina", meta: 0, realizado: 0, projecao: 0, percentual: 0, source: "" },
    Retaludamento: { area: "Retaludamento", meta: 0, realizado: 0, projecao: 0, percentual: 0, source: "" },
  };

  const debug: Array<{ sheet: string; headerRow: number; map: MetricColumnMap; matched: number }> = [];

  for (const sheet of worksheetNames) {
    try {
      const range = await getUsedRange(client, driveId, itemId, sheet);
      const values = (range?.values ?? []) as unknown[][];
      if (!values.length) continue;
      const { row: headerRow, map } = detectHeaderRow(values);
      if (headerRow < 0 || map.equipamento === undefined) {
        debug.push({ sheet, headerRow, map, matched: 0 });
        continue;
      }
      let matched = 0;
      for (let r = headerRow + 1; r < values.length; r++) {
        const row = values[r] ?? [];
        const label = String(row[map.equipamento!] ?? "");
        const eq = matchEquipment(label);
        const area = matchArea(label);
        if (!eq && !area) continue;
        matched++;

        if (eq) {
          const target = acc[eq];
          const setIfAvail = (key: keyof MetricColumnMap, field: keyof EquipmentMetrics) => {
            const c = map[key];
            if (c === undefined) return;
            const v = toNumber(row[c]);
            if (v && typeof target[field] === "number") {
              (target[field] as number) = Math.max(target[field] as number, v);
            }
          };
          setIfAvail("horasTrabalhadas", "horasTrabalhadas");
          setIfAvail("producao", "producao");
          setIfAvail("produtividade", "produtividade");
          setIfAvail("manutencao", "manutencao");
          setIfAvail("preventiva", "preventiva");
          setIfAvail("df", "df");
          setIfAvail("ut", "ut");
          if (!target.source) target.source = sheet;
        }
        if (area) {
          const a = areas[area];
          const setArea = (key: keyof MetricColumnMap, field: keyof AreaMetrics) => {
            const c = map[key];
            if (c === undefined) return;
            const v = toNumber(row[c]);
            if (v && typeof a[field] === "number") {
              (a[field] as number) = Math.max(a[field] as number, v);
            }
          };
          setArea("meta", "meta");
          setArea("realizado", "realizado");
          setArea("producao", "realizado");
          setArea("projecao", "projecao");
          setArea("percentual", "percentual");
          if (!a.source) a.source = sheet;
        }
      }
      debug.push({ sheet, headerRow, map, matched });
    } catch (err) {
      console.warn(`[excel] erro ao ler aba ${sheet}`, err);
    }
  }

  for (const eq of TARGET_EQUIPMENT) {
    const m = acc[eq];
    if (!m.produtividade && m.horasTrabalhadas > 0 && m.producao > 0) {
      m.produtividade = m.producao / m.horasTrabalhadas;
    }
  }
  for (const k of Object.keys(areas) as AreaName[]) {
    const a = areas[k];
    if (!a.percentual && a.meta > 0 && a.realizado > 0) {
      a.percentual = (a.realizado / a.meta) * 100;
    }
  }

  return { metrics: acc as Record<TargetEquipment, EquipmentMetrics>, areas, debug };
}

export interface SheetValues {
  name: string;
  values: unknown[][];
}

/**
 * Variant that accepts already-loaded sheet values (from xlsx local upload, OneDrive, etc).
 * Reuses the same column detection + equipment/area matching logic as readWorkbookMetrics.
 */
export function processSheetValues(sheets: SheetValues[]): {
  metrics: Record<TargetEquipment, EquipmentMetrics>;
  areas: Record<AreaName, AreaMetrics>;
  debug: Array<{ sheet: string; headerRow: number; map: MetricColumnMap; matched: number }>;
  rows: GenericEquipmentRow[];
  summary: AggregateSummary;
  primarySheet: string | null;
} {
  const acc: Record<string, EquipmentMetrics> = {};
  TARGET_EQUIPMENT.forEach((eq) => {
    acc[eq] = {
      equipamento: eq,
      horasTrabalhadas: 0,
      producao: 0,
      produtividade: 0,
      manutencao: 0,
      preventiva: 0,
      df: 0,
      ut: 0,
      source: "",
    };
  });

  const areas: Record<AreaName, AreaMetrics> = {
    Mina: { area: "Mina", meta: 0, realizado: 0, projecao: 0, percentual: 0, source: "" },
    Retaludamento: { area: "Retaludamento", meta: 0, realizado: 0, projecao: 0, percentual: 0, source: "" },
  };

  const debug: Array<{ sheet: string; headerRow: number; map: MetricColumnMap; matched: number }> = [];
  const rowsByName = new Map<string, GenericEquipmentRow>();
  let primarySheet: string | null = null;

  for (const { name: sheet, values } of sheets) {
    if (!values.length) continue;
    const { row: headerRow, map } = detectHeaderRow(values);
    if (headerRow < 0 || map.equipamento === undefined) {
      debug.push({ sheet, headerRow, map, matched: 0 });
      continue;
    }
    if (!primarySheet) primarySheet = sheet;
    let matched = 0;
    for (let r = headerRow + 1; r < values.length; r++) {
      const row = values[r] ?? [];
      const label = String(row[map.equipamento!] ?? "");
      const eq = matchEquipment(label);
      const area = matchArea(label);
      const isEquipLike = looksLikeEquipmentLabel(label);
      if (!eq && !area && !isEquipLike) continue;
      matched++;

      // Generic accumulator (works for any equipment in the spreadsheet)
      if (isEquipLike && !area) {
        const key = norm(label);
        let g = rowsByName.get(key);
        if (!g) {
          g = {
            equipamento: label.trim(),
            category: classifyEquipment(label),
            horasTrabalhadas: 0,
            producao: 0,
            produtividade: 0,
            manutencao: 0,
            preventiva: 0,
            df: 0,
            ut: 0,
            source: sheet,
          };
          rowsByName.set(key, g);
        }
        const setG = (k: keyof MetricColumnMap, f: keyof GenericEquipmentRow) => {
          const c = map[k];
          if (c === undefined) return;
          const v = toNumber(row[c]);
          if (v && typeof g![f] === "number") {
            (g![f] as number) = Math.max(g![f] as number, v);
          }
        };
        setG("horasTrabalhadas", "horasTrabalhadas");
        setG("producao", "producao");
        setG("produtividade", "produtividade");
        setG("manutencao", "manutencao");
        setG("preventiva", "preventiva");
        setG("df", "df");
        setG("ut", "ut");
      }

      if (eq) {
        const target = acc[eq];
        const setIfAvail = (key: keyof MetricColumnMap, field: keyof EquipmentMetrics) => {
          const c = map[key];
          if (c === undefined) return;
          const v = toNumber(row[c]);
          if (v && typeof target[field] === "number") {
            (target[field] as number) = Math.max(target[field] as number, v);
          }
        };
        setIfAvail("horasTrabalhadas", "horasTrabalhadas");
        setIfAvail("producao", "producao");
        setIfAvail("produtividade", "produtividade");
        setIfAvail("manutencao", "manutencao");
        setIfAvail("preventiva", "preventiva");
        setIfAvail("df", "df");
        setIfAvail("ut", "ut");
        if (!target.source) target.source = sheet;
      }
      if (area) {
        const a = areas[area];
        const setArea = (key: keyof MetricColumnMap, field: keyof AreaMetrics) => {
          const c = map[key];
          if (c === undefined) return;
          const v = toNumber(row[c]);
          if (v && typeof a[field] === "number") {
            (a[field] as number) = Math.max(a[field] as number, v);
          }
        };
        setArea("meta", "meta");
        setArea("realizado", "realizado");
        setArea("producao", "realizado");
        setArea("projecao", "projecao");
        setArea("percentual", "percentual");
        if (!a.source) a.source = sheet;
      }
    }
    debug.push({ sheet, headerRow, map, matched });
  }

  for (const eq of TARGET_EQUIPMENT) {
    const m = acc[eq];
    if (!m.produtividade && m.horasTrabalhadas > 0 && m.producao > 0) {
      m.produtividade = m.producao / m.horasTrabalhadas;
    }
  }
  for (const k of Object.keys(areas) as AreaName[]) {
    const a = areas[k];
    if (!a.percentual && a.meta > 0 && a.realizado > 0) {
      a.percentual = (a.realizado / a.meta) * 100;
    }
  }

  const rows = Array.from(rowsByName.values()).map((g) => {
    if (!g.produtividade && g.horasTrabalhadas > 0 && g.producao > 0) {
      g.produtividade = g.producao / g.horasTrabalhadas;
    }
    return g;
  });

  const filterPos = (arr: number[]) => arr.filter((x) => x > 0);
  const meanPos = (arr: number[]) => {
    const f = filterPos(arr);
    return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
  };

  const totalMeta = (areas.Mina.meta ?? 0) + (areas.Retaludamento.meta ?? 0);
  const totalRealizado = (areas.Mina.realizado ?? 0) + (areas.Retaludamento.realizado ?? 0);
  const totalProducao = rows.reduce((s, r) => s + (r.producao || 0), 0);

  const summary: AggregateSummary = {
    produtividade: meanPos(rows.map((r) => r.produtividade)),
    ut: meanPos(rows.map((r) => r.ut)),
    df: meanPos(rows.map((r) => r.df)),
    manutencao: rows.reduce((s, r) => s + (r.manutencao || 0), 0),
    preventiva: rows.reduce((s, r) => s + (r.preventiva || 0), 0),
    totalProducao,
    totalMeta,
    totalRealizado: totalRealizado || totalProducao,
    aderencia: totalMeta ? ((totalRealizado || totalProducao) / totalMeta) * 100 : 0,
    rowsProcessed: rows.length,
    equipmentCount: rows.length,
    escavadeirasCount: rows.filter((r) => r.category === "escavadeira").length,
    perfuratrizesCount: rows.filter((r) => r.category === "perfuratriz").length,
    frotaCrCount: rows.filter((r) => r.category === "caminhao").length,
  };

  return { metrics: acc as Record<TargetEquipment, EquipmentMetrics>, areas, debug, rows, summary, primarySheet };
}