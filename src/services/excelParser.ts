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
  hourlySeries?: HourlyProduction[];
  /** ISO yyyy-mm-dd lido da célula DATA: na aba PRODUÇÃO EH (dia da operação) */
  dataPlanilha?: string;
  /** Ranking de produtividade (T/H) por escavadeira EH-XXXX a partir da aba PRODUÇÃO EH. */
  ehRanking?: EhRankingItem[];
}

export interface EhRankingItem {
  equipamento: string;
  producao: number;
  horas: number; // mantido p/ compat: agora representa o horímetro final
  tph: number;
}

export interface HourlyProduction {
  hora: string;
  hour: number;
  tonH: number;
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
    // Aumentado de 10 para 30 — em algumas planilhas o mini-box
    // (Turno1/Turno2/Acumulado/Projetado) começa abaixo da linha 10.
    const HEADER_SCAN_ROWS = 30;
    for (let r = 0; r < Math.min(prodEh.values.length, HEADER_SCAN_ROWS); r++) {
      const row = prodEh.values[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (/retalud/.test(norm(row[c]))) retaludAnchors.push({ row: r, col: c });
      }
    }
    retaludDebug.anchors = retaludAnchors;

    // --- Lê a célula DATA: no topo da aba PRODUÇÃO EH ---
    // Ex.: A7 = "DATA:" e B7 = 10/05/2026. É a fonte de verdade do dia da operação.
    for (let r = 0; r < Math.min(prodEh.values.length, HEADER_SCAN_ROWS); r++) {
      const row = prodEh.values[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        const lab = norm(row[c]);
        if (/^data\s*:?$/.test(lab)) {
          // Procura a primeira data válida nas próximas 5 colunas
          for (let cc = c + 1; cc <= c + 5 && cc < row.length; cc++) {
            const k = cellToDateKey(row[cc]);
            if (k) {
              summary.dataPlanilha = k;
              break;
            }
          }
        }
        if (summary.dataPlanilha) break;
      }
      if (summary.dataPlanilha) break;
    }
    if (summary.dataPlanilha) {
      console.log("[excelParser] DATA da planilha (PRODUÇÃO EH):", summary.dataPlanilha);
    }

    // Build set of columns considered to belong to a RETALUDAMENTO block.
    // We expand 6 columns to the right of each anchor, which covers both the
    // mini "Turno/Acumulado/Projetado" box and the per-hour table header.
    const retaludCols = new Set<number>();
    for (const a of retaludAnchors) {
      // Span 12 cols to the right to cover the per-hour table (HORA, TURNO,
      // up to 9 equipamentos and TOTAL — 12+ columns).
      for (let k = a.col; k <= a.col + 12; k++) retaludCols.add(k);
    }
    const retaludStartCol = retaludAnchors.length
      ? Math.min(...retaludAnchors.map((anchor) => anchor.col))
      : Number.POSITIVE_INFINITY;
    retaludDebug.retaludStartCol = Number.isFinite(retaludStartCol) ? retaludStartCol : null;

    // --- Locate "TOTAL" header columns precisely ---
    // The header row (usually row index 7 / row 8 in Excel) has "TOTAL" once
    // for the Mina block and once for the Retaludamento block. We use those
    // exact columns to read the totals from the TOTAL row (row 33 / idx 32).
    let minaTotalCol = -1;
    let retaludTotalCol = -1;
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(prodEh.values.length, 12); r++) {
      const row = prodEh.values[r] ?? [];
      const hasTurno = row.some((v) => /^turno$/i.test(String(v ?? "").trim()));
      const hasTotal = row.some((v) => /^total$/i.test(String(v ?? "").trim()));
      if (hasTurno && hasTotal) {
        headerRowIdx = r;
        for (let c = 0; c < row.length; c++) {
          if (/^total$/i.test(String(row[c] ?? "").trim())) {
            if (retaludCols.has(c)) {
              if (retaludTotalCol < 0) retaludTotalCol = c;
            } else {
              if (minaTotalCol < 0) minaTotalCol = c;
            }
          }
        }
        break;
      }
    }
    retaludDebug.headerRowIdx = headerRowIdx;
    retaludDebug.minaTotalCol = minaTotalCol;
    retaludDebug.retaludTotalCol = retaludTotalCol;

    // --- Find the TOTAL row (label "TOTAL" in column 0 OR 18 below headers) ---
    let totalRowIdx = -1;
    for (let r = (headerRowIdx >= 0 ? headerRowIdx + 1 : 0); r < prodEh.values.length; r++) {
      const row = prodEh.values[r] ?? [];
      if (/^total$/i.test(String(row[0] ?? "").trim())) {
        totalRowIdx = r;
        break;
      }
    }
    retaludDebug.totalRowIdx = totalRowIdx;

    // Read totals directly from the TOTAL row at the located columns
    if (totalRowIdx >= 0) {
      const trow = prodEh.values[totalRowIdx] ?? [];
      if (minaTotalCol >= 0) {
        const v = toNumber(trow[minaTotalCol]);
        if (v > 0) producaoDia = v;
      }
      if (retaludTotalCol >= 0) {
        const v = toNumber(trow[retaludTotalCol]);
        if (v > 0) producaoRetalud = v;
      }
    }

    // --- Extract HOURLY production series (Mina) from PRODUÇÃO EH ---
    // Rows between headerRow+1 and totalRow have HORA in col 0 and TOTAL at minaTotalCol.
    if (headerRowIdx >= 0 && minaTotalCol >= 0) {
      const startR = headerRowIdx + 1;
      const endR = totalRowIdx > 0 ? totalRowIdx : prodEh.values.length;
      const series: HourlyProduction[] = [];
      for (let r = startR; r < endR; r++) {
        const row = prodEh.values[r] ?? [];
        const hraw = row[0];
        const hnum = typeof hraw === "number" ? hraw : Number(String(hraw ?? "").trim());
        if (!Number.isFinite(hnum) || hnum < 0 || hnum > 23) continue;
        const v = toNumber(row[minaTotalCol]);
        series.push({
          hour: hnum,
          hora: `${String(hnum).padStart(2, "0")}:00`,
          tonH: v > 0 ? v : 0,
        });
      }
      if (series.length) {
        // Sort by hour starting at 00:00
        series.sort((a, b) => a.hour - b.hour);
        summary.hourlySeries = series;
      }
    }

    // --- Ranking de produtividade por escavadeira (EH-XXXX) ---
    // Localiza o bloco "TON/H" na aba PRODUÇÃO EH e varre as linhas seguintes
    // extraindo, via regex no texto completo da linha, o nome (EH-XXXX) e o
    // valor numérico seguido de "t/h". Isso torna o parser robusto a variações
    // de coluna/posição na planilha.
    {
      const ranking: EhRankingItem[] = [];
      // 1) Acha a linha que contém "TON/H" (cabeçalho do bloco)
      let tonhRow = -1;
      for (let r = 0; r < prodEh.values.length; r++) {
        const text = (prodEh.values[r] ?? []).join(" ").toUpperCase();
        if (/\bTON\s*\/\s*H\b/.test(text)) {
          tonhRow = r;
          break;
        }
      }
      const startR = tonhRow >= 0 ? tonhRow + 1 : (totalRowIdx > 0 ? totalRowIdx + 1 : 0);
      const endR = Math.min(prodEh.values.length, startR + 40);
      const seen = new Set<string>();
      for (let r = startR; r < endR; r++) {
        const row = prodEh.values[r] ?? [];
        const text = row.map((v) => (v == null ? "" : String(v))).join(" ");
        const matchEH = text.match(/EH[-\s]?\d+/i);
        if (!matchEH) continue;
        const equipamento = matchEH[0].toUpperCase().replace(/\s+/, "-");
        if (seen.has(equipamento)) continue;
        // Procura primeiro número > 0 na linha (col B normalmente)
        let tph = 0;
        const matchTPH = text.match(/(\d+[.,]?\d*)\s*t\s*\/\s*h/i);
        if (matchTPH) {
          tph = Number(matchTPH[1].replace(/\./g, "").replace(",", "."));
        } else {
          for (let c = 1; c < row.length; c++) {
            const v = toNumber(row[c]);
            if (v > 0) { tph = v; break; }
          }
        }
        if (!Number.isFinite(tph) || tph <= 0) continue;
        seen.add(equipamento);
        ranking.push({
          equipamento,
          producao: 0,
          horas: 0,
          tph: Math.round(tph),
        });
      }
      if (ranking.length) {
        ranking.sort((a, b) => b.tph - a.tph);
        summary.ehRanking = ranking;
        console.log("[excelParser] ranking EH (bloco TON/H):", ranking);
      }
    }

    // Helper: read first numeric cell to the right of column `c` within `span`.
    const numRight = (row: unknown[], c: number, span = 5): number => {
      for (let cc = c + 1; cc <= c + span && cc < row.length; cc++) {
        const v = toNumber(row[cc]);
        if (v > 0) return v;
      }
      return 0;
    };

    // --- Pass 1: scan ALL rows for "Acumulado dia"/"Projetado dia" labels ---
    // O mini-box (Turno1/Turno2/Acumulado/Projetado) é a fonte de verdade dos
    // totais oficiais — preferimos esses valores em vez da soma da tabela
    // hora-a-hora. Varremos a aba inteira pra tolerar variações de layout.
    const turnoRetalud: number[] = [];
    for (let r = 0; r < prodEh.values.length; r++) {
      const row = prodEh.values[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        const lab = norm(row[c]);
        const isRetaludCol =
          retaludCols.has(c) ||
          (Number.isFinite(retaludStartCol) && c >= retaludStartCol - 1);
        if (/acumulado\s*dia/.test(lab)) {
          const v = numRight(row, c);
          if (v > 0) {
            if (isRetaludCol) producaoRetalud = v;
            else producaoDia = v;
          }
        } else if (/projetad[oa]\s*dia/.test(lab)) {
          const v = numRight(row, c);
          if (v > 0) {
            if (isRetaludCol) projetadoRetalud = v;
            else projetadoDia = v;
          }
        } else if (isRetaludCol && /^turno\s*[12]\s*:?$/.test(lab)) {
          const v = numRight(row, c);
          if (v > 0) turnoRetalud.push(v);
        }
      }
    }
    retaludDebug.turnoRetalud = turnoRetalud;

    // --- Pass 2: fallback via "TOTAL" row of the per-hour RETALUDAMENTO table.
    // Only if we did NOT detect a precise TOTAL column above. Skip Excel date
    // serials (>40000) which can leak into retaludCols span.
    if (!producaoRetalud && retaludAnchors.length && retaludTotalCol < 0) {
      for (let r = 0; r < prodEh.values.length; r++) {
        const row = prodEh.values[r] ?? [];
        const hasTotal = row.some((v) => norm(v) === "total");
        if (!hasTotal) continue;
        let mx = 0;
        for (let c = 0; c < row.length; c++) {
          if (!retaludCols.has(c)) continue;
          const v = toNumber(row[c]);
          if (v > mx && v < 40000) mx = v;
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
    if (typeof window !== "undefined") {
      console.debug("[excelParser] retaludamento debug", {
        ...retaludDebug,
        producaoRetalud,
        projetadoRetalud,
        producaoDia,
        projetadoDia,
      });
    }

    // Fallback: if header detection failed, scan the TOTAL row for the first
    // reasonable numeric in the Mina block (cols 0..15). We skip values that
    // look like Excel date serials (>40000) to avoid picking up B7+P33+1.
    if (!producaoDia) {
      for (let r = 0; r < prodEh.values.length; r++) {
        const row = prodEh.values[r] ?? [];
        if (norm(row[0]) === "total") {
          let mx = 0;
          for (let c = 0; c < Math.min(row.length, 16); c++) {
            const v = toNumber(row[c]);
            if (v > mx && v < 40000) mx = v;
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
      // Find latest date — supports Date, ISO string, dd/mm/yyyy and serial number
      let latestKey = "";
      for (let r = hr + 1; r < rows.length; r++) {
        const k = cellToDateKey((rows[r] ?? [])[dCol]);
        if (k && k > latestKey) latestKey = k;
      }
      // Sum prod where Obra matches "morro" on the latest date
      for (let r = hr + 1; r < rows.length; r++) {
        const row = rows[r] ?? [];
        const k = cellToDateKey(row[dCol]);
        if (!k || k !== latestKey) continue;
        const obra = norm(row[obraCol]);
        if (!/morro/.test(obra)) continue;
        acumuladoMorro1 += toNumber(row[prodCol]);
      }
      console.log("[excelParser] MORRO 1 acumulado (data", latestKey, "):", acumuladoMorro1);
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

  // Pass FINAL: leitura por âncoras textuais (PRODUÇÃO REALIZADA / TON/H /
  // ACUMULADO MÊS) — replica exatamente o algoritmo de referência do cliente
  // e SOBREPÕE os valores anteriores quando encontrados.
  applyDashboardAnchors(sheets, areas, summary, fleets, acc);

  // Validação por aba — confirma se datas e totais foram lidos
  validateSheets(sheets, overrides, summary);

  return { metrics: acc as Record<TargetEquipment, EquipmentMetrics>, areas, debug, rows, summary, primarySheet, fleets };
}

/**
 * Pass final baseado em âncoras textuais — replica o parser de referência:
 *   "PRODUÇÃO REALIZADA" → próximas 2 linhas: Mina, Retaludamento (col 1=realizado, 2=meta, 3=%)
 *   "TON/H"              → próximas linhas: ranking EH-XXXX → t/h
 *   "ACUMULADO MÊS"      → próximas linhas: equipamento, horasParadas, DF, UT, código, HT
 */
function applyDashboardAnchors(
  sheets: SheetValues[],
  areas: Record<AreaName, AreaMetrics>,
  summary: AggregateSummary,
  fleets: Record<TargetEquipment, FleetAggregate>,
  acc: Record<string, EquipmentMetrics>,
) {
  const limparNumero = (v: unknown): number => {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return v;
    const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  for (const { name: sheetName, values } of sheets) {
    if (!values?.length) continue;
    const upperRows = values.map((row) => (row ?? []).map((v) => String(v ?? "")).join(" ").toUpperCase());

    // ---------- PRODUÇÃO REALIZADA ----------
    const linhaProd = upperRows.findIndex((t) => t.includes("PRODUÇÃO REALIZADA") || t.includes("PRODUCAO REALIZADA"));
    if (linhaProd >= 0) {
      const lMina = values[linhaProd + 1] ?? [];
      const lRet = values[linhaProd + 2] ?? [];
      const minaReal = limparNumero(lMina[1]);
      const minaMeta = limparNumero(lMina[2]);
      const minaPct = limparNumero(lMina[3]);
      const retReal = limparNumero(lRet[1]);
      const retMeta = limparNumero(lRet[2]);
      const retPct = limparNumero(lRet[3]);
      if (minaReal || minaMeta) {
        areas.Mina.realizado = minaReal;
        areas.Mina.meta = minaMeta;
        areas.Mina.percentual = minaPct || (minaMeta ? (minaReal / minaMeta) * 100 : 0);
        areas.Mina.source = sheetName;
      }
      if (retReal || retMeta) {
        areas.Retaludamento.realizado = retReal;
        areas.Retaludamento.meta = retMeta;
        areas.Retaludamento.percentual = retPct || (retMeta ? (retReal / retMeta) * 100 : 0);
        areas.Retaludamento.source = sheetName;
      }
      const totalMeta = areas.Mina.meta + areas.Retaludamento.meta;
      const totalReal = areas.Mina.realizado + areas.Retaludamento.realizado;
      if (totalReal) summary.totalRealizado = totalReal;
      if (totalMeta) summary.totalMeta = totalMeta;
      if (totalMeta) summary.aderencia = (totalReal / totalMeta) * 100;
      console.log(`[anchors] PRODUÇÃO REALIZADA @${sheetName} L${linhaProd}`, { minaReal, minaMeta, retReal, retMeta });
    }

    // ---------- TON/H (ranking de escavadeiras) ----------
    const linhaTonH = upperRows.findIndex((t) => /\bTON\s*\/\s*H\b/.test(t));
    if (linhaTonH >= 0) {
      const ranking: EhRankingItem[] = [];
      const seen = new Set<string>();
      const end = Math.min(values.length, linhaTonH + 25);
      for (let i = linhaTonH + 1; i < end; i++) {
        const row = values[i] ?? [];
        const text = row.map((v) => String(v ?? "")).join(" ");
        const mEH = text.match(/EH[-\s]?\d+/i);
        if (!mEH) continue;
        const equip = mEH[0].toUpperCase().replace(/\s+/, "-");
        if (seen.has(equip)) continue;
        const mTph = text.match(/(\d+[.,]?\d*)\s*t\s*\/\s*h/i);
        let tph = 0;
        if (mTph) {
          tph = limparNumero(mTph[1]);
        } else {
          for (let c = 1; c < row.length; c++) {
            const v = limparNumero(row[c]);
            if (v > 0) { tph = v; break; }
          }
        }
        if (tph <= 0) continue;
        seen.add(equip);
        ranking.push({ equipamento: equip, producao: 0, horas: 0, tph: Math.round(tph) });
      }
      if (ranking.length) {
        ranking.sort((a, b) => b.tph - a.tph);
        summary.ehRanking = ranking;
        console.log(`[anchors] TON/H @${sheetName}`, ranking);
      }
    }

    // ---------- ACUMULADO MÊS ----------
    const linhaAcum = upperRows.findIndex((t) => t.includes("ACUMULADO MÊS") || t.includes("ACUMULADO MES"));
    if (linhaAcum >= 0) {
      const end = Math.min(values.length, linhaAcum + 15);
      for (let i = linhaAcum + 1; i < end; i++) {
        const row = values[i] ?? [];
        const equip = String(row[0] ?? "").trim();
        if (!equip) continue;
        const horasParadas = limparNumero(row[1]);
        const df = limparNumero(row[2]);
        const ut = limparNumero(row[3]);
        const ht = limparNumero(row[5]);

        // Mapeia para uma das 4 frotas-alvo
        const tgt = matchEquipment(equip);
        if (tgt) {
          const m = acc[tgt];
          if (df) m.df = df;
          if (ut) m.ut = ut;
          if (ht) m.horasTrabalhadas = ht;
          if (horasParadas) m.manutencao = horasParadas;
          m.source = m.source || sheetName;

          const f = fleets[tgt];
          if (df) f.df = df;
          if (ut) f.ut = ut;
          if (ht) f.totalHoras = ht;
          if (horasParadas) f.horasManutencao = horasParadas;
        }
      }
      // Recalcula UT/DF globais com a média ponderada simples das frotas
      const dfs = TARGET_EQUIPMENT.map((f) => fleets[f].df).filter((x) => x > 0);
      const uts = TARGET_EQUIPMENT.map((f) => fleets[f].ut).filter((x) => x > 0);
      if (dfs.length) summary.df = dfs.reduce((a, b) => a + b, 0) / dfs.length;
      if (uts.length) summary.ut = uts.reduce((a, b) => a + b, 0) / uts.length;
      console.log(`[anchors] ACUMULADO MÊS @${sheetName}`, { dfs, uts });
    }
  }
}

/**
 * Valida cada aba esperada e loga PASS/FAIL com contagem de linhas, datas e totais
 * lidos. Útil para diagnosticar quando a planilha (OneDrive ou upload local) não
 * está atualizando os indicadores.
 */
function validateSheets(
  sheets: SheetValues[],
  overrides: { dateKey: string | null; producaoDia: number; producaoRetalud: number },
  summary: AggregateSummary,
) {
  const byName = new Map(sheets.map((s) => [s.name.toLowerCase(), s]));
  const expected: Array<{ key: string; label: string; needs: string[] }> = [
    { key: "horimetros", label: "Horimetros", needs: ["data", "equipamento", "frota", "horas trabalhadas"] },
    { key: "paradas", label: "Paradas", needs: ["data", "frota", "tempo de parada", "categoria"] },
    { key: "produção eh", label: "PRODUÇÃO EH", needs: ["acumulado dia / total"] },
    { key: "retaludamento", label: "RETALUDAMENTO", needs: ["data", "obra", "produção"] },
  ];

  console.groupCollapsed("[excelParser] ✅ Validação por aba");
  for (const exp of expected) {
    const sh =
      byName.get(exp.key) ||
      [...byName.values()].find((s) => new RegExp(exp.key.replace(/\s+/g, "\\s*"), "i").test(s.name));
    if (!sh) {
      console.warn(`❌ [${exp.label}] aba NÃO encontrada na planilha. Esperado: ${exp.needs.join(", ")}`);
      continue;
    }
    const rows = sh.values?.length ?? 0;
    if (!rows) {
      console.warn(`❌ [${exp.label}] aba vazia.`);
      continue;
    }
    // Tenta detectar datas na coluna "DATA" para reportar range
    let dateCol = -1;
    let headerRow = -1;
    for (let r = 0; r < Math.min(rows, 12); r++) {
      const dc = findHeaderIndex(sh.values[r] ?? [], [/^data$/]);
      if (dc >= 0) { dateCol = dc; headerRow = r; break; }
    }
    let minDate = "", maxDate = "", dateCount = 0;
    if (dateCol >= 0) {
      for (let r = headerRow + 1; r < rows; r++) {
        const k = cellToDateKey((sh.values[r] ?? [])[dateCol]);
        if (!k) continue;
        dateCount++;
        if (!minDate || k < minDate) minDate = k;
        if (!maxDate || k > maxDate) maxDate = k;
      }
    }
    const ok = rows > 1 && (dateCol < 0 || dateCount > 0);
    const icon = ok ? "✅" : "⚠️";
    console.log(
      `${icon} [${exp.label}] linhas=${rows}` +
        (dateCol >= 0 ? ` · datas=${dateCount} (${minDate || "?"} → ${maxDate || "?"})` : " · sem coluna DATA"),
    );
    if (!ok) console.warn(`   ↳ Carregamento parcial/falhou para "${exp.label}". Verifique o cabeçalho da aba.`);
  }
  console.log(
    `📊 Totais calculados → data ref=${overrides.dateKey ?? "?"} · ` +
      `producaoDia=${overrides.producaoDia} · producaoRetalud=${overrides.producaoRetalud} · ` +
      `acumuladoMorro1=${summary.acumuladoMorro1 ?? 0}`,
  );
  console.groupEnd();
}