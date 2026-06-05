require('dotenv').config();
const { fetchFromSSRS } = require('./sync');
const logger = require('./logger');

async function testSSRS() {
  logger.info("Iniciando teste de conexão com o SSRS...");
  try {
    const data = await fetchFromSSRS();
    if (data) {
      logger.info("Teste bem-sucedido. SSRS retornou dados.");
      console.log("Amostra dos dados retornados:\n" + data.substring(0, 500) + "...\n");
    } else {
      logger.warn("Teste retornou vazio.");
    }
  } catch (err) {
    logger.error("Falha no teste SSRS:", err.message);
  }
}

testSSRS();
