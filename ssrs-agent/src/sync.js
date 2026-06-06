require('dotenv').config();
const axios = require('axios');
const { NtlmClient } = require('axios-ntlm');
const csv = require('csvtojson');
const logger = require('./logger');

const SSRS_URL = process.env.SSRS_URL || 'http://192.168.17.15/ReportServer';
const SSRS_REPORT_PATH = process.env.SSRS_REPORT_PATH || '/JMineOPS/Relatorios_HOMOLOGAÇÃO/Produção Diária';
const SSRS_USERNAME = process.env.SSRS_USERNAME;
const SSRS_PASSWORD = process.env.SSRS_PASSWORD;
const INGEST_URL = process.env.INGEST_URL;
const AGENT_TOKEN = process.env.AGENT_TOKEN;
const AGENT_NAME = process.env.AGENT_NAME || require('os').hostname();
const AGENT_VERSION = '1.0.0';
const REPORT_ID = 'producao_diaria';

let lastSyncDate = null;
let lastSyncProcessed = 0;
let ssrsStatus = "disconnected";
let ingestStatus = "disconnected";

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

// Mapeamento difuso para o payload aceito pela Edge Function ingest-mineops
// (tabela producao_diaria — chave: data_referencia + turno + relatorio_origem)
function mapToProducaoDiaria(row) {
  const keys = Object.keys(row);
  const findKey = (keywords) => keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
  const num = (k) => (k && row[k] !== '' && row[k] != null ? Number(String(row[k]).replace(',', '.')) : null);

  const dateKey  = findKey(['data', 'date']);
  const shiftKey = findKey(['turno', 'shift']);

  const mapped = {
    data_referencia: dateKey ? row[dateKey] : null,
    turno: shiftKey ? String(row[shiftKey]) : null,
    toneladas_total: num(findKey(['tonelada', 'tons', 'producao_total'])),
    producao_hora: num(findKey(['producao_hora', 'prod/h', 'ton/h'])),
    disponibilidade_fisica_df: num(findKey(['disponibilidade', 'df'])),
    utilizacao_ut: num(findKey(['utilizacao', 'ut'])),
    equipamentos_disponiveis: num(findKey(['equip_disp', 'disponiveis'])),
    equipamentos_utilizados: num(findKey(['equip_util', 'utilizados'])),
    carga_operando: num(findKey(['carga', 'escavadeira'])),
    transporte_operando: num(findKey(['transporte', 'caminhao'])),
    payload_bruto: row,
  };

  if (!mapped.data_referencia) return null;
  return mapped;
}

async function runSync() {
  try {
    if (!INGEST_URL || !AGENT_TOKEN) {
      throw new Error('INGEST_URL e AGENT_TOKEN são obrigatórios no .env');
    }

    logger.info("Iniciando sincronização SSRS...");
    const csvData = await fetchFromSSRS();

    if (!csvData) {
      logger.warn("Nenhum dado retornado do SSRS.");
      return;
    }

    const rawJson = await csv().fromString(csvData);
    logger.info(`Processando ${rawJson.length} registros...`);

    if (rawJson.length === 0) return;

    const registros = rawJson.map(mapToProducaoDiaria).filter(Boolean);

    if (registros.length === 0) {
      logger.warn("Nenhum registro válido após mapeamento.");
      return;
    }

    // Envia em lotes para a Edge Function ingest-mineops
    const chunkSize = 500;
    let totalEnviado = 0;
    for (let i = 0; i < registros.length; i += chunkSize) {
      const chunk = registros.slice(i, i + chunkSize);
      try {
        const resp = await axios.post(
          INGEST_URL,
          {
            relatorio: REPORT_ID,
            agente_versao: AGENT_VERSION,
            agente_host: AGENT_NAME,
            registros: chunk,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${AGENT_TOKEN}`,
            },
            timeout: 30000,
          }
        );
        ingestStatus = "connected";
        totalEnviado += resp.data?.recebidos ?? chunk.length;
      } catch (err) {
        ingestStatus = "error";
        const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        throw new Error(`Falha ao enviar para ingest-mineops: ${detail}`);
      }
    }

    lastSyncDate = new Date();
    lastSyncProcessed = totalEnviado;
    logger.info(`Sincronização concluída. ${totalEnviado} registros enviados para ingest-mineops.`);

  } catch (error) {
    logger.error("Falha na sincronização:", error.message || error);
  }
}

function getStats() {
    return {
        ssrsStatus,
        ingestStatus,
        lastSyncDate,
        lastSyncProcessed
    };
}

module.exports = { runSync, fetchFromSSRS, mapToProducaoDiaria, getStats };
