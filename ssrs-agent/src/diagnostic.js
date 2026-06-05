require('dotenv').config();
const csv = require('csvtojson');
const { fetchFromSSRS, mapToDailyProduction } = require('./sync');
const logger = require('./logger');

async function runDiagnostic() {
  logger.info("Iniciando modo diagnóstico...");
  try {
    const csvData = await fetchFromSSRS();
    if (!csvData) {
      logger.warn("Diagnóstico: Sem dados do SSRS.");
      return;
    }
    
    const rawJson = await csv().fromString(csvData);
    logger.info(`Diagnóstico: CSV parseado com ${rawJson.length} linhas.`);
    
    if (rawJson.length > 0) {
      console.log("\n--- ESTRUTURA ORIGINAL DO CSV (Primeira Linha) ---");
      console.log(JSON.stringify(rawJson[0], null, 2));
      
      const mapped = rawJson.map(mapToDailyProduction);
      console.log("\n--- ESTRUTURA MAPEADA PARA O SUPABASE (Primeira Linha) ---");
      console.log(JSON.stringify(mapped[0], null, 2));
    }
  } catch (err) {
    logger.error("Erro no diagnóstico:", err);
  }
}

runDiagnostic();
