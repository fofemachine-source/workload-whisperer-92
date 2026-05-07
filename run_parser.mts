import * as XLSX from 'xlsx';
import fs from 'node:fs';
// Stub import.meta.env for msalConfig (transitively imported)
process.env.VITE_MICROSOFT_CLIENT_ID = 'x';
process.env.VITE_MICROSOFT_TENANT_ID = 'x';
const { processSheetValues } = await import('/dev-server/src/services/excelParser.ts');
const buf = fs.readFileSync('/dev-server/cp_test.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
const sheets = wb.SheetNames.map(name => ({
  name,
  values: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true }) as unknown[][],
}));
const out = processSheetValues(sheets);
console.log("acumuladoDia:", out.summary.acumuladoDia);
console.log("projetadoDia:", out.summary.projetadoDia);
console.log("acumuladoRetalud:", out.summary.acumuladoRetalud);
console.log("projetadoRetalud:", out.summary.projetadoRetalud);
console.log("totalProducao:", out.summary.totalProducao);
