import { Client } from "@microsoft/microsoft-graph-client";
import { getUsedRange } from "./graphService";

export const TARGET_EQUIPMENT = ["EX1200", "EX2500", "Komatsu 730", "Komatsu 785"] as const;
export type TargetEquipment = (typeof TARGET_EQUIPMENT)[number];

/**
 * Frota operacional fixa definida pela operação (turno = dia).
 * Foco: apenas caminhão e escavadeira (48 equipamentos de produção no total).
 */
export const FLEET_SIZE: Record<TargetEquipment, number> = {
  "Komatsu 785": 25,
  "Komatsu 730": 15,
  EX2500: 3,
  EX1200: 5,
};
export const FLEET_TOTAL = 48;
export const ESCAVADEIRAS: TargetEquipment[] = ["EX1200", "EX2500"];
export const CAMINHOES: TargetEquipment[] = ["Komatsu 730", "Komatsu 785"];

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
  totalCaminhoes: number;
  totalEscavadeiras: number;
  toneladaPorHora: number;
  acumuladoDia?: number;
  projetadoDia?: number;
  acumuladoRetalud?: number;
  projetadoRetalud?: number;
  acumuladoMorro1?: number;
  projetadoMorro1?: number;
}

export interface FleetAggregate {
  fleet: TargetEquipment;
  category: "escavadeira" | "caminhao";
  totalUnits: number;        // tamanho fixo da frota
  ativos: number;            // unidades com horas trabalhadas > 0
  emManutencao: number;      // unidades com horas de manutenção > 0
  totalProducao: number;
  totalHoras: number;
  produtividade: number;     // produção / horas
  df: number;                // DF = HD / HT  (0-100)
  ut: number;                // UT = HTra / HD (0-100)
  horasTotais: number;       // HT = totalUnits * turno
  horasManutencao: number;   // HM = soma manutenção da frota
  horasDisponiveis: number;  // HD = HT - HM
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
  fleet?: TargetEquipment | null;
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

/**
 * Classifica TAGs (CR-xxxx, EH-xxxx) nas 4 frotas-alvo, replicando o cadastro:
 * - EH-40xx => HITACHI EX1200; EH-50xx => HITACHI EX2500
 * - CR-25xx => KOMATSU HD785;  CR-30xx/31xx => KOMATSU 730E
 */
function fleetByTag(label: string): TargetEquipment | null {
  const n = norm(label).toUpperCase();
  let m = n.match(/^EH[-\s]?(\d{2})/);
  if (m) {
    const p = m[1];
    if (p.startsWith("40")) return "EX1200";
    if (p.startsWith("50")) return "EX2500";
  }
  m = n.match(/^CR[-\s]?(\d{2})/);
  if (m) {
    const p = m[1];
    if (p.startsWith("25")) return "Komatsu 785";
    if (p.startsWith("30") || p.startsWith("31")) return "Komatsu 730";
  }
  return matchEquipment(label);
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
 * Maps "Frota" cell text from Horimetros/Paradas to one of the 4 target fleets.
 */
function frotaTextToTarget(s: unknown): TargetEquipment | null {
  const n = norm(s);
  if (!n) return null;
  if (/ex\W*1200/.test(n)) return "EX1200";
  if (/ex\W*2500/.test(n)) return "EX2500";
  if (/785/.test(n)) return "Komatsu 785";
  if (/730/.test(n)) return "Komatsu 730";
  return null;
}

/** Parse Excel date cell (Date object, ISO string, or serial number) -> YYYY-MM-DD */
function cellToDateKey(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
}

function findHeaderIndex(headerRow: unknown[], patterns: RegExp[]): number {
  for (let c = 0; c < headerRow.length; c++) {
    const cell = norm(headerRow[c]);
    if (patterns.some((re) => re.test(cell))) return c;
  }
  return -1;
}

/**
 * Reads structured sheets (Horimetros, Paradas, PRODUÇÃO EH) and recomputes
 * fleet aggregates & global summary using precise business rules:
 *   - Horimetros: HTra summed per Equipamento, FILTERED by latest date
 *   - Paradas:    Manutenção summed per Equipamento, FILTERED by same date
 *   - PRODUÇÃO EH: total day production from row "TOTAL"
 *   - DF = HD/HT, UT = HTra/HD  (HT = unidades * 24h)
 */
function applyStructuredOverrides(
  sheets: SheetValues[],
  fleets: Record<TargetEquipment, FleetAggregate>,
  summary: AggregateSummary,
): { dateKey: string | null; producaoDia: number; producaoRetalud: number } {
  const byName = new Map(sheets.map((s) => [s.name.toLowerCase(), s]));
  const horim = byName.get("horimetros");
  const paradas = byName.get("paradas");
  const prodEh =
    byName.get("produção eh") ||
    byName.get("producao eh") ||
    [...byName.values()].find((s) => /produ[cç][aã]o\s*eh\b/i.test(s.name));

  // 1) Determine target date from Horimetros (latest non-empty)
  let dateKey: string | null = null;
  let dateColH = -1, eqColH = -1, frotaColH = -1, htColH = -1, headerH = -1;
  if (horim && horim.values.length > 4) {
    // Header is around row 4 in user file; scan first 10 rows
    for (let r = 0; r < Math.min(horim.values.length, 12); r++) {
      const row = horim.values[r] ?? [];
      const dc = findHeaderIndex(row, [/^data$/]);
      const ec = findHeaderIndex(row, [/equipamento/]);
      const fc = findHeaderIndex(row, [/^frota$/]);
      const hc = findHeaderIndex(row, [/horas?\s*trabalhad/]);
      if (dc >= 0 && ec >= 0 && fc >= 0 && hc >= 0) {
        headerH = r; dateColH = dc; eqColH = ec; frotaColH = fc; htColH = hc;
        break;
      }
    }
    if (headerH >= 0) {
      // Find latest date in column
      let latest = "";
      for (let r = headerH + 1; r < horim.values.length; r++) {
        const k = cellToDateKey((horim.values[r] ?? [])[dateColH]);
        if (k && k > latest) latest = k;
      }
      dateKey = latest || null;
    }
  }

  // 2) Aggregate HTra per fleet for the target date
  const htraByFleet: Record<TargetEquipment, number> = {
    EX1200: 0, EX2500: 0, "Komatsu 730": 0, "Komatsu 785": 0,
  };
  const ativosByFleet: Record<TargetEquipment, Set<string>> = {
    EX1200: new Set(), EX2500: new Set(), "Komatsu 730": new Set(), "Komatsu 785": new Set(),
  };
  if (horim && headerH >= 0 && dateKey) {
    for (let r = headerH + 1; r < horim.values.length; r++) {
      const row = horim.values[r] ?? [];
      const k = cellToDateKey(row[dateColH]);
      if (k !== dateKey) continue;
      const f = frotaTextToTarget(row[frotaColH]);
      if (!f) continue;
      const ht = toNumber(row[htColH]);
      htraByFleet[f] += ht;
      const eq = String(row[eqColH] ?? "").trim();
      if (eq && ht > 0) ativosByFleet[f].add(eq);
    }
  }

  // 3) Aggregate Manutenção per fleet for same date from Paradas
  const manutByFleet: Record<TargetEquipment, number> = {
    EX1200: 0, EX2500: 0, "Komatsu 730": 0, "Komatsu 785": 0,
  };
  if (paradas && paradas.values.length > 3 && dateKey) {
    // Header on row index 2 typically
    let headerP = -1, dateColP = -1, frotaColP = -1, horasColP = -1, catColP = -1;
    for (let r = 0; r < Math.min(paradas.values.length, 8); r++) {
      const row = paradas.values[r] ?? [];
      const dc = findHeaderIndex(row, [/^data$/]);
      const fc = findHeaderIndex(row, [/^frota$/]);
      const hc = findHeaderIndex(row, [/tempo\s*de\s*parada\s*\(hor/]);
      const cc = findHeaderIndex(row, [/categoria/]);
      if (dc >= 0 && fc >= 0 && hc >= 0 && cc >= 0) {
        headerP = r; dateColP = dc; frotaColP = fc; horasColP = hc; catColP = cc;
        break;
      }
    }
    if (headerP >= 0) {
      for (let r = headerP + 1; r < paradas.values.length; r++) {
        const row = paradas.values[r] ?? [];
        const k = cellToDateKey(row[dateColP]);
        if (k !== dateKey) continue;
        const cat = norm(row[catColP]);
        if (!/manuten|preventiv|corretiv/.test(cat)) continue;
        const f = frotaTextToTarget(row[frotaColP]);
        if (!f) continue;
        manutByFleet[f] += toNumber(row[horasColP]);
      }
    }
  }

  // 4) Production from PRODUÇÃO EH "TOTAL" row + Retaludamento header cells
  let producaoDia = 0;
  let producaoRetalud = 0;
  let projetadoDia = 0;
  let projetadoRetalud = 0;
  const retaludDebug: Record<string, unknown> = {};
  if (prodEh && prodEh.values.length) {
    // --- Locate RETALUDAMENTO header blocks at the TOP of the sheet only ---
    // The mini-summary boxes ("Turno1/Turno2/Acumulado/Projetado") live in the
    // first ~10 rows. Anchors deeper in the sheet (e.g. detail rows in column 0)
    // would wrongly mark the N5-SUL summary columns as belonging to retaludamento.
    const retaludAnchors: { row: number; col: number }[] = [];
    const HEADER_SCAN_ROWS = 10;
    for (let r = 0; r < Math.min(prodEh.values.length, HEADER_SCAN_ROWS); r++) {
      const row = prodEh.values[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (/retalud/.test(norm(row[c]))) retaludAnchors.push({ row: r, col: c });
      }
    }
    retaludDebug.anchors = retaludAnchors;

    // Build set of columns considered to belong to a RETALUDAMENTO block.
    // We expand 6 columns to the right of each anchor, which covers both the
    // mini "Turno/Acumulado/Projetado" box and the per-hour table header.
    const retaludCols = new Set<number>();
    for (const a of retaludAnchors) {
      for (let k = a.col; k <= a.col + 6; k++) retaludCols.add(k);
    }

    // Helper: read first numeric cell to the right of column `c` within `span`.
    const numRight = (row: unknown[], c: number, span = 5): number => {
      for (let cc = c + 1; cc <= c + span && cc < row.length; cc++) {
        const v = toNumber(row[cc]);
        if (v > 0) return v;
      }
      return 0;
    };

    // --- Pass 1: scan TOP rows for "Acumulado dia"/"Projetado dia" labels ---
    // Decide which bucket (Mina vs Retaludamento) by column membership.
    const turnoRetalud: number[] = [];
    for (let r = 0; r < Math.min(prodEh.values.length, HEADER_SCAN_ROWS); r++) {
      const row = prodEh.values[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        const lab = norm(row[c]);
        const isRetaludCol = retaludCols.has(c);
        if (/acumulado\s*dia/.test(lab)) {
          const v = numRight(row, c);
          if (v > 0) {
            if (isRetaludCol) { if (!producaoRetalud) producaoRetalud = v; }
            else { if (!producaoDia) producaoDia = v; }
          }
        } else if (/projetad[oa]\s*dia/.test(lab)) {
          const v = numRight(row, c);
          if (v > 0) {
            if (isRetaludCol) { if (!projetadoRetalud) projetadoRetalud = v; }
            else { if (!projetadoDia) projetadoDia = v; }
          }
        } else if (isRetaludCol && /^turno\s*[12]\s*:?$/.test(lab)) {
          const v = numRight(row, c);
          if (v > 0) turnoRetalud.push(v);
        }
      }
    }
    retaludDebug.turnoRetalud = turnoRetalud;

    // --- Pass 2: fallback via "TOTAL" row of the per-hour RETALUDAMENTO table.
    // If we found anchors but no value, sum numeric cells of the TOTAL row that
    // sit inside retaludCols.
    if (!producaoRetalud && retaludAnchors.length) {
      for (let r = 0; r < prodEh.values.length; r++) {
        const row = prodEh.values[r] ?? [];
        // first cell of row says "TOTAL" or any cell in the row equals "TOTAL"
        const hasTotal = row.some((v) => norm(v) === "total");
        if (!hasTotal) continue;
        // find largest numeric in retaludCols range for this row
        let mx = 0;
        for (let c = 0; c < row.length; c++) {
          if (!retaludCols.has(c)) continue;
          const v = toNumber(row[c]);
          if (v > mx) mx = v;
        }
        if (mx > 0) {
          producaoRetalud = mx;
          retaludDebug.totalRowFallback = mx;
          break;
        }
      }
    }

    // --- Pass 3: Turno1 + Turno2 fallback for Acumulado ---
    if (!producaoRetalud && turnoRetalud.length >= 2) {
      producaoRetalud = turnoRetalud.slice(0, 2).reduce((s, v) => s + v, 0);
      retaludDebug.turnoSumFallback = producaoRetalud;
    }

    // --- Validation: Acumulado ≈ Turno1 + Turno2 (within 5%) ---
    if (producaoRetalud > 0 && turnoRetalud.length >= 2) {
      const sum = turnoRetalud[0] + turnoRetalud[1];
      const drift = Math.abs(sum - producaoRetalud) / producaoRetalud;
      if (drift > 0.05) {
        console.warn(
          `[excelParser] RETALUDAMENTO inconsistente: Turno1+Turno2=${sum} vs Acumulado=${producaoRetalud}`
        );
        retaludDebug.inconsistencyDrift = drift;
      }
    }

    // --- Validation: warn if RETALUDAMENTO header exists but no value found ---
    if (retaludAnchors.length && !producaoRetalud) {
      console.warn("[excelParser] PRODUÇÃO EH contém 'RETALUDAMENTO' mas nenhum valor numérico foi extraído.");
    }
    if (process?.env?.NODE_ENV !== "production" || typeof window !== "undefined") {
      console.debug("[excelParser] retaludamento debug", {
        ...retaludDebug,
        producaoRetalud,
        projetadoRetalud,
        producaoDia,
        projetadoDia,
      });
    }

    // Fallback: TOTAL row
    if (!producaoDia) {
      for (let r = 0; r < prodEh.values.length; r++) {
        const row = prodEh.values[r] ?? [];
        if (norm(row[0]) === "total") {
          // last numeric cell in row
          let mx = 0;
          for (const c of row) {
            const v = toNumber(c);
            if (v > mx) mx = v;
          }
          producaoDia = mx;
          break;
        }
      }
    }
  }

  // 5) Recompute fleet aggregates with precise values
  const TURNO_H = 24;
  TARGET_EQUIPMENT.forEach((f) => {
    const agg = fleets[f];
    const htra = htraByFleet[f];
    const horasManut = manutByFleet[f];
    const horasTotais = agg.totalUnits * TURNO_H;
    const horasDisp = Math.max(horasTotais - horasManut, 0);
    if (htra > 0 || horasManut > 0) {
      agg.totalHoras = htra;
      agg.horasManutencao = horasManut;
      agg.horasTotais = horasTotais;
      agg.horasDisponiveis = horasDisp;
      agg.df = horasTotais > 0 ? (horasDisp / horasTotais) * 100 : 0;
      agg.ut = horasDisp > 0 ? (htra / horasDisp) * 100 : 0;
      agg.ativos = ativosByFleet[f].size;
    }
  });

  // 6) Distribute Produção do dia between escavadeira fleets proportionally to HTra
  if (producaoDia > 0) {
    const escavHtra = ESCAVADEIRAS.reduce((s, f) => s + fleets[f].totalHoras, 0);
    ESCAVADEIRAS.forEach((f) => {
      const agg = fleets[f];
      agg.totalProducao = escavHtra > 0 ? producaoDia * (agg.totalHoras / escavHtra) : 0;
      agg.produtividade = agg.totalHoras > 0 ? agg.totalProducao / agg.totalHoras : 0;
    });
    // Caminhões: distribute also proportionally so cards show something coherent
    CAMINHOES.forEach((f) => {
      const agg = fleets[f];
      const camHtra = CAMINHOES.reduce((s, x) => s + fleets[x].totalHoras, 0);
      agg.totalProducao = camHtra > 0 ? producaoDia * (agg.totalHoras / camHtra) : 0;
      agg.produtividade = agg.totalHoras > 0 ? agg.totalProducao / agg.totalHoras : 0;
    });
  }

  // 7) Global summary recompute
  const sumHT = TARGET_EQUIPMENT.reduce((s, f) => s + fleets[f].horasTotais, 0);
  const sumHD = TARGET_EQUIPMENT.reduce((s, f) => s + fleets[f].horasDisponiveis, 0);
  const sumHTra = TARGET_EQUIPMENT.reduce((s, f) => s + fleets[f].totalHoras, 0);
  const escavHtra = ESCAVADEIRAS.reduce((s, f) => s + fleets[f].totalHoras, 0);

  if (producaoDia > 0) {
    summary.totalProducao = producaoDia;
    summary.toneladaPorHora = escavHtra > 0 ? producaoDia / escavHtra : 0;
    summary.produtividade = summary.toneladaPorHora;
    summary.totalRealizado = producaoDia + producaoRetalud;
  }
  summary.acumuladoDia = producaoDia || 0;
  summary.projetadoDia = projetadoDia || producaoDia || 0;
  summary.acumuladoRetalud = producaoRetalud || 0;
  summary.projetadoRetalud = projetadoRetalud || producaoRetalud || 0;

  // 7.b) RETALUDAMENTO por Obra (MORRO 1) — soma da aba "RETALUDAMENTO"
  // filtrada pela data mais recente, agrupando coluna "Obra".
  const retaludSheet =
    byName.get("retaludamento") ||
    [...byName.values()].find((s) => /^retalud/i.test(s.name));
  let acumuladoMorro1 = 0;
  if (retaludSheet?.values?.length) {
    const rows = retaludSheet.values;
    // Detect header row: needs DATA + Obra + Produção columns
    let hr = -1, dCol = -1, obraCol = -1, prodCol = -1;
    for (let r = 0; r < Math.min(rows.length, 12); r++) {
      const row = rows[r] ?? [];
      const dc = findHeaderIndex(row, [/^data$/]);
      const oc = findHeaderIndex(row, [/^obra$/]);
      const pc = findHeaderIndex(row, [/produ[cç][aã]o/]);
      if (dc >= 0 && oc >= 0 && pc >= 0) {
        hr = r; dCol = dc; obraCol = oc; prodCol = pc;
        break;
      }
    }
    if (hr >= 0) {
      // Find latest date
      let maxD = 0;
      for (let r = hr + 1; r < rows.length; r++) {
        const dv = Number((rows[r] ?? [])[dCol]);
        if (Number.isFinite(dv) && dv > maxD) maxD = dv;
      }
      // Sum prod where Obra matches "morro"
      for (let r = hr + 1; r < rows.length; r++) {
        const row = rows[r] ?? [];
        if (Number(row[dCol]) !== maxD) continue;
        const obra = norm(row[obraCol]);
        if (!/morro/.test(obra)) continue;
        acumuladoMorro1 += toNumber(row[prodCol]);
      }
      console.log("[excelParser] MORRO 1 acumulado (data", maxD, "):", acumuladoMorro1);
    }
  }
  summary.acumuladoMorro1 = acumuladoMorro1;
  summary.projetadoMorro1 = acumuladoMorro1; // mesma lógica do N5-SUL (projetado = acumulado)

  if (sumHT > 0) summary.df = (sumHD / sumHT) * 100;
  if (sumHD > 0) summary.ut = (sumHTra / sumHD) * 100;
  summary.totalCaminhoes = CAMINHOES.reduce((s, f) => s + fleets[f].ativos, 0);
  summary.totalEscavadeiras = ESCAVADEIRAS.reduce((s, f) => s + fleets[f].ativos, 0);

  return { dateKey, producaoDia, producaoRetalud };
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
  fleets: Record<TargetEquipment, FleetAggregate>;
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
            fleet: fleetByTag(label),
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

  // Agregação por frota-alvo (apenas caminhão e escavadeira)
  const fleets = {} as Record<TargetEquipment, FleetAggregate>;
  TARGET_EQUIPMENT.forEach((f) => {
    fleets[f] = {
      fleet: f,
      category: ESCAVADEIRAS.includes(f) ? "escavadeira" : "caminhao",
      totalUnits: FLEET_SIZE[f],
      ativos: 0,
      emManutencao: 0,
      totalProducao: 0,
      totalHoras: 0,
      produtividade: 0,
      df: 0,
      ut: 0,
      horasTotais: 0,
      horasManutencao: 0,
      horasDisponiveis: 0,
    };
  });
  for (const r of rows) {
    const f = r.fleet;
    if (!f) continue;
    const agg = fleets[f];
    if (r.horasTrabalhadas > 0) agg.ativos++;
    if (r.manutencao > 0) agg.emManutencao++;
    agg.totalProducao += r.producao || 0;
    agg.totalHoras += r.horasTrabalhadas || 0;
    agg.horasManutencao += r.manutencao || 0;
  }
  TARGET_EQUIPMENT.forEach((f) => {
    const agg = fleets[f];
    agg.produtividade = agg.totalHoras > 0 ? agg.totalProducao / agg.totalHoras : 0;
    // Regra do cliente:
    //   HT  = horas totais       = totalUnits * 24h (turno=dia)
    //   HM  = horas em manutenção (somadas da planilha; fallback: emManutencao * 24h)
    //   HD  = HT - HM            (horas disponíveis)
    //   HTra= horas trabalhadas  (somadas da planilha)
    //   DF  = HD / HT * 100      (Disponibilidade Física)
    //   UT  = HTra / HD * 100    (Utilização)
    const TURNO_H = 24;
    const horasTotais = agg.totalUnits * TURNO_H;
    const horasManut = agg.horasManutencao > 0 ? agg.horasManutencao : agg.emManutencao * TURNO_H;
    const horasDisp = Math.max(horasTotais - horasManut, 0);
    agg.horasTotais = horasTotais;
    agg.horasManutencao = horasManut;
    agg.horasDisponiveis = horasDisp;
    agg.df = horasTotais > 0 ? (horasDisp / horasTotais) * 100 : 0;
    agg.ut = horasDisp > 0 ? (agg.totalHoras / horasDisp) * 100 : 0;
  });

  const filterPos = (arr: number[]) => arr.filter((x) => x > 0);
  const meanPos = (arr: number[]) => {
    const f = filterPos(arr);
    return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
  };

  const totalMeta = (areas.Mina.meta ?? 0) + (areas.Retaludamento.meta ?? 0);
  const totalRealizado = (areas.Mina.realizado ?? 0) + (areas.Retaludamento.realizado ?? 0);
  const totalProducao = rows.reduce((s, r) => s + (r.producao || 0), 0);

  // Foco apenas em caminhão e escavadeira (regra de negócio)
  const caminhoes = rows.filter((r) => r.category === "caminhao");
  const escavadeiras = rows.filter((r) => r.category === "escavadeira");

  // Tonelada/hora = toda tonelada movimentada / horas rodadas das escavadeiras
  const horasEscav = escavadeiras.reduce((s, r) => s + (r.horasTrabalhadas || 0), 0);
  const toneladaPorHora = horasEscav > 0 ? totalProducao / horasEscav : 0;

  // Médias ponderadas para DF e UT considerando apenas caminhão + escavadeira
  const fleet = [...caminhoes, ...escavadeiras];
  const meanFleet = (vals: number[]) => {
    const f = vals.filter((x) => x > 0);
    return f.length ? f.reduce((a, b) => a + b, 0) / f.length : 0;
  };

  // DF/UT globais usando soma das frotas (HT, HD, HTra) — mesma regra do cliente
  const sumHT = TARGET_EQUIPMENT.reduce((s, f) => s + fleets[f].horasTotais, 0);
  const sumHD = TARGET_EQUIPMENT.reduce((s, f) => s + fleets[f].horasDisponiveis, 0);
  const sumHTra = TARGET_EQUIPMENT.reduce((s, f) => s + fleets[f].totalHoras, 0);
  const dfGlobal = sumHT > 0 ? (sumHD / sumHT) * 100 : 0;
  const utGlobal = sumHD > 0 ? (sumHTra / sumHD) * 100 : 0;

  const summary: AggregateSummary = {
    produtividade: toneladaPorHora || meanPos(rows.map((r) => r.produtividade)),
    ut: utGlobal || meanFleet(fleet.map((r) => r.ut)),
    df: dfGlobal || meanFleet(fleet.map((r) => r.df)),
    manutencao: rows.reduce((s, r) => s + (r.manutencao || 0), 0),
    preventiva: rows.reduce((s, r) => s + (r.preventiva || 0), 0),
    totalProducao,
    totalMeta,
    totalRealizado: totalRealizado || totalProducao,
    aderencia: totalMeta ? ((totalRealizado || totalProducao) / totalMeta) * 100 : 0,
    rowsProcessed: rows.length,
    equipmentCount: rows.length,
    escavadeirasCount: escavadeiras.length,
    perfuratrizesCount: rows.filter((r) => r.category === "perfuratriz").length,
    frotaCrCount: caminhoes.length,
    totalCaminhoes: caminhoes.length,
    totalEscavadeiras: escavadeiras.length,
    toneladaPorHora,
  };

  // Override with structured data when available (Horimetros/Paradas/PRODUÇÃO EH)
  const overrides = applyStructuredOverrides(sheets, fleets, summary);
  console.log("[excelParser] structured overrides:", overrides);

  return { metrics: acc as Record<TargetEquipment, EquipmentMetrics>, areas, debug, rows, summary, primarySheet, fleets };
}