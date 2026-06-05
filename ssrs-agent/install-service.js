const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'SSRS Sync Agent',
  description: 'Sincroniza os relatórios do SSRS para o Supabase.',
  script: path.join(__dirname, 'src', 'index.js'),
  env: [{
    name: "NODE_ENV",
    value: "production"
  }]
});

svc.on('install', function() {
  console.log('Serviço SSRS Sync Agent instalado com sucesso.');
  svc.start();
});

svc.install();
