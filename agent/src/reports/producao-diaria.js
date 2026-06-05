/**
 * Mapeamento do relatório "Produção Diária" do MineOPS.
 *
 * IMPORTANTE: o nome das colunas no CSV depende de como o relatório foi
 * publicado no SSRS. Ajuste os nomes em `mapRow` conforme o cabeçalho real
 * do CSV exportado por:
 *   http://192.168.17.15/ReportServer?/.../Producao Diaria&rs:Format=CSV
 */

function num(v) {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function int(v) {
  const n = num(v);
  return n === null ? null : Math.round(n);
}

function isoDate(v) {
  if (!v) return null;
  // aceita "dd/MM/yyyy" ou "yyyy-MM-dd"
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return s.slice(0, 10);
  return null;
}

export const producaoDiaria = {
  id: "producao_diaria",
  defaultPath: "/JMineOPS/Relatorios_HOMOLOGACAO/Producao Diaria",
  format: "CSV",
  params: {},

  mapRow(row) {
    const data_referencia =
      isoDate(row["Data"]) ||
      isoDate(row["DataReferencia"]) ||
      isoDate(row["Data Referência"]) ||
      isoDate(row["DATA"]);
    if (!data_referencia) return null;

    return {
      data_referencia,
      turno: row["Turno"] ?? row["TURNO"] ?? null,
      toneladas_total: num(row["Toneladas"] ?? row["Toneladas Total"] ?? row["TonTotal"]),
      producao_hora: num(row["Produção/Hora"] ?? row["ProducaoHora"] ?? row["ton/h"]),
      disponibilidade_fisica_df: num(row["DF"] ?? row["Disponibilidade Física"] ?? row["DisponibilidadeFisica"]),
      utilizacao_ut: num(row["UT"] ?? row["Utilização"] ?? row["Utilizacao"]),
      equipamentos_disponiveis: int(row["EquipDisponiveis"] ?? row["Equipamentos Disponíveis"]),
      equipamentos_utilizados: int(row["EquipUtilizados"] ?? row["Equipamentos Utilizados"]),
      carga_operando: int(row["CargaOperando"] ?? row["Carga Operando"]),
      transporte_operando: int(row["TransporteOperando"] ?? row["Transporte Operando"]),
      payload_bruto: row,
    };
  },
};