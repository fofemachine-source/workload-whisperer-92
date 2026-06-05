require('dotenv').config();
const axios = require('axios');
const { NtlmClient } = require('axios-ntlm');
const csv = require('csvtojson');
const logger = require('./logger');
const supabase = require('./supabase');

const SSRS_URL = process.env.SSRS_URL || 'http://192.168.17.15/ReportServer';
const SSRS_REPORT_PATH = process.env.SSRS_REPORT_PATH || '/JMineOPS/Relatorios_HOMOLOGAÇÃO/Produção Diária';
const SSRS_USERNAME = process.env.SSRS_USERNAME;
const SSRS_PASSWORD = process.env.SSRS_PASSWORD;

let lastSyncDate = null;
let lastSyncProcessed = 0;
let ssrsStatus = "disconnected";
let supabaseStatus = "disconnected";

async function fetchFromSSRS() {
  const fullUrl = `${SSRS_URL}?${SSRS_REPORT_PATH}&rs:Command=Render&rs:Format=CSV`;
  
  try {
    const response = await axios.get(fullUrl, {
      auth: { username: SSRS_USERNAME, password: SSRS_PASSWORD },
      responseType: 'text',
      timeout: 15000
    });
    ssrsStatus = "connected";
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      try {
        const ntlmClient = NtlmClient({ username: SSRS_USERNAME, password: SSRS_PASSWORD });
        const response = await ntlmClient.get(fullUrl, { responseType: 'text', timeout: 15000 });
        ssrsStatus = "connected";
        return response.data;
      } catch (ntlmErr) {
        ssrsStatus = "error";
        throw new Error(`NTLM Auth failed: ${ntlmErr.message}`);
      }
    } else {
      ssrsStatus = "error";
      throw new Error(`SSRS Fetch failed: ${error.message}`);
    }
  }
}

// Mapeamento difuso para colunas conhecidas
function mapToDailyProduction(row) {
  const keys = Object.keys(row);
  const findKey = (keywords) => keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
  
  const mapped = {};
  
  // Date
  const dateKey = findKey(['data', 'date']);
  if (dateKey) mapped.date = row[dateKey];
  
  // Shift
  const shiftKey = findKey(['turno', 'shift']);
  if (shiftKey) mapped.shift = row[shiftKey];
  
  // Equipment ID (UUID)
  const equipKey = findKey(['equipamento', 'equipment', 'frota']);
  if (equipKey) mapped.equipment_id = row[equipKey];
  
  // Location ID (UUID)
  const locKey = findKey(['local', 'location', 'frente', 'origem']);
  if (locKey) mapped.location_id = row[locKey];
  
  // Material
  const matKey = findKey(['material', 'minerio', 'estéril']);
  if (matKey) mapped.material = row[matKey];
  
  // Trips
  const tripKey = findKey(['viagen', 'trip']);
  if (tripKey) mapped.trips = parseInt(row[tripKey], 10) || 0;
  
  // Tons Produced
  const tonsKey = findKey(['tonelada', 'producao', 'peso', 'tons']);
  if (tonsKey) mapped.tons_produced = parseFloat(row[tonsKey]) || 0;
  
  // Hours
  const hrWKey = findKey(['horas trab', 'trabalhado', 'operacao']);
  if (hrWKey) mapped.hours_worked = parseFloat(row[hrWKey]) || 0;
  
  const hrSKey = findKey(['horas parada', 'parado']);
  if (hrSKey) mapped.hours_stopped = parseFloat(row[hrSKey]) || 0;
  
  // Horimeter
  const horiStartKey = findKey(['horimetro ini', 'horimeter start']);
  if (horiStartKey) mapped.horimeter_start = parseFloat(row[horiStartKey]) || null;
  
  const horiEndKey = findKey(['horimetro fin', 'horimeter end']);
  if (horiEndKey) mapped.horimeter_end = parseFloat(row[horiEndKey]) || null;
  
  // A primary key identifier from SSRS if present, for UPSERT
  const idKey = findKey(['id', 'codigo']);
  if (idKey && row[idKey]) {
      mapped.id = row[idKey];
  }
  
  return mapped;
}

async function runSync() {
  try {
    logger.info("Iniciando sincronização SSRS...");
    const csvData = await fetchFromSSRS();
    
    if (!csvData) {
      logger.warn("Nenhum dado retornado do SSRS.");
      return;
    }

    const rawJson = await csv().fromString(csvData);
    logger.info(`Processando ${rawJson.length} registros...`);

    if (rawJson.length === 0) return;

    // Map rows
    const mappedRows = rawJson.map(mapToDailyProduction).filter(r => r.date || r.equipment_id);
    
    // Test Supabase connection
    const { error: pingErr } = await supabase.from('daily_production').select('id').limit(1);
    if (pingErr) {
        supabaseStatus = "error";
        throw new Error(`Supabase ping failed: ${pingErr.message}`);
    }
    supabaseStatus = "connected";

    // Upsert chunks to avoid payload size errors
    const chunkSize = 1000;
    for (let i = 0; i < mappedRows.length; i += chunkSize) {
        const chunk = mappedRows.slice(i, i + chunkSize);
        
        // Se a tabela usar o ID UUID e os dados do SSRS não trouxerem UUID, 
        // o Supabase insere novo se não passar ID, ou falha se tentarmos UPSERT 
        // em onConflict que não é UUID. Se SSRS não manda uuid, devemos usar insert simples ou 
        // deletar dados daquele dia/turno e re-inserir.
        // Padrão adotado: insert para adicionar. Se houver chave id, upsert.
        
        const { error } = await supabase
          .from('daily_production')
          .upsert(chunk, { ignoreDuplicates: false }); 
          
        if (error) {
          logger.error("Erro inserindo no Supabase:", error);
          throw error;
        }
    }

    lastSyncDate = new Date();
    lastSyncProcessed = mappedRows.length;
    logger.info(`Sincronização concluída. ${lastSyncProcessed} registros inseridos/atualizados.`);

  } catch (error) {
    logger.error("Falha na sincronização:", error.message || error);
    // Erros são tratados e ignorados para que o cron tente novamente na próxima rodada
  }
}

function getStats() {
    return {
        ssrsStatus,
        supabaseStatus,
        lastSyncDate,
        lastSyncProcessed
    };
}

module.exports = { runSync, fetchFromSSRS, mapToDailyProduction, getStats };
