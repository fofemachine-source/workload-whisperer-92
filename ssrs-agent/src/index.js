require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const logger = require('./logger');
const { runSync } = require('./sync');
const supabase = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3000;
const SYNC_INTERVAL = process.env.SYNC_INTERVAL || 300; // segundos

// Endpoint de Teste
app.get('/health', async (req, res) => {
  let ssrsStatus = "disconnected";
  let supabaseStatus = "disconnected";

  // Check Supabase
  try {
    const { error } = await supabase.from('daily_production').select('*').limit(1);
    if (!error) supabaseStatus = "connected";
  } catch (e) {
    logger.error("Health check - Supabase error:", e.message);
  }

  // O SSRS não será testado a cada chamada para não sobrecarregar, 
  // mas vamos assumir conectado se tivermos variáveis configuradas
  if (process.env.SSRS_URL && process.env.SSRS_USERNAME) {
    ssrsStatus = "connected"; // ou pode implementar um ping rápido
  }

  res.json({
    status: "online",
    ssrs: ssrsStatus,
    supabase: supabaseStatus
  });
});

app.listen(PORT, () => {
  logger.info(`Agente SSRS rodando na porta ${PORT}`);
  
  // Agendar sincronização
  // Converte SYNC_INTERVAL (segundos) para cron syntax
  // Se for 300 segundos = 5 minutos: */5 * * * *
  const minutes = Math.floor(SYNC_INTERVAL / 60);
  const cronExpression = `*/${minutes > 0 ? minutes : 1} * * * *`;
  
  logger.info(`Job de sincronização agendado com a expressão cron: ${cronExpression}`);
  cron.schedule(cronExpression, () => {
    runSync();
  });
  
  // Roda uma vez ao iniciar
  runSync();
});
