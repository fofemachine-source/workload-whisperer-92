const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'SSRS Sync Agent',
  script: path.join(__dirname, 'src', 'index.js')
});

svc.on('uninstall', function() {
  console.log('Serviço SSRS Sync Agent desinstalado com sucesso.');
});

svc.uninstall();
