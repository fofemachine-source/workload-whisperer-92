require('dotenv').config();
const axios = require('axios');
const { NtlmClient } = require('axios-ntlm');
const csv = require('csvtojson');
const logger = require('./logger');
const supabase = require('./supabase');

const SSRS_URL = process.env.SSRS_URL;
const SSRS_REPORT_PATH = process.env.SSRS_REPORT_PATH || '/JMineOPS/Relatorios_HOMOLOGAÇÃO/Produção Diária';
const SSRS_USERNAME = process.env.SSRS_USERNAME;
const SSRS_PASSWORD = process.env.SSRS_PASSWORD;

async function fetchFromSSRS() {
  const fullUrl = `${SSRS_URL}?${SSRS_REPORT_PATH}&rs:Command=Render&rs:Format=CSV`;
  
  // Tentativa 1: Basic Auth
  try {
    logger.info("Tentando autenticar no SSRS com Basic Auth...");
    const response = await axios.get(fullUrl, {
      auth: {
        username: SSRS_USERNAME,
        password: SSRS_PASSWORD
      },
      responseType: 'text'
    });
    logger.info("SSRS: Autenticação Basic Auth bem sucedida.");
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logger.info("SSRS: Basic Auth falhou (401). Tentando NTLM...");
      // Tentativa 2: NTLM
      const ntlmClient = NtlmClient({
        username: SSRS_USERNAME,
        password: SSRS_PASSWORD
      });
      const response = await ntlmClient.get(fullUrl, {
        responseType: 'text'
      });
      logger.info("SSRS: Autenticação NTLM bem sucedida.");
      return response.data;
    } else {
      throw error;
    }
  }
}

async function runSync() {
  try {
    logger.info("Iniciando sincronização SSRS...");
    
    // 1. Fetch CSV
    const csvData = await fetchFromSSRS();
    
    if (!csvData) {
      logger.warn("Nenhum dado retornado do SSRS.");
      return;
    }

    // 2. Parse CSV to JSON
    const jsonArray = await csv().fromString(csvData);
    logger.info(`Convertido para JSON: ${jsonArray.length} registros encontrados.`);

    if (jsonArray.length === 0) {
      return;
    }

    // 3. Upsert to Supabase
    // Assume-se que a tabela "daily_production" existe.
    // Vamos mapear os campos caso o CSV venha com nomes diferentes (ajuste conforme necessário)
    // Se o CSV já vier com as colunas certas, basta enviar direto
    
    const { data, error } = await supabase
      .from('daily_production')
      .upsert(jsonArray, { onConflict: 'id' }); // assumindo que exista um ID ou chave primária

    if (error) {
      logger.error("Erro ao inserir no Supabase:", error);
      throw error;
    }

    logger.info("Sincronização concluída com sucesso.");
  } catch (error) {
    logger.error("Falha na sincronização:", error.message || error);
  }
}

module.exports = { runSync };
