require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const logger = require('./logger');
const { runSync, getStats } = require('./sync');

const app = express();
const PORT = process.env.PORT || 3000;
const SYNC_INTERVAL = process.env.SYNC_INTERVAL || 300; // segundos

app.get('/health', async (req, res) => {
  const stats = getStats();

  res.json({
    status: "online",
    ssrs: stats.ssrsStatus,
    supabase: stats.supabaseStatus,
    last_sync: stats.lastSyncDate,
    records_processed: stats.lastSyncProcessed
  });
});

app.listen(PORT, () => {
  logger.info(`Agente SSRS rodando na porta ${PORT}`);
  
  const minutes = Math.floor(SYNC_INTERVAL / 60);
  const cronExpression = `*/${minutes > 0 ? minutes : 1} * * * *`;
  
  logger.info(`Job de sincronização agendado com a expressão cron: ${cronExpression}`);
  cron.schedule(cronExpression, () => {
    runSync();
  });
  
  // Roda imediatamente na primeira vez
  runSync();
});
