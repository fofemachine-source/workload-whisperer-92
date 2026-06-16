# SQL Server Diagnostic (JMineOps)

Projeto Node.js para descobrir o schema do banco `jmineops_uem` no SQL Server.

## Como usar

```bash
cd sqlserver-diagnostic
npm install
cp .env.example .env   # opcional — valores padrão já apontam para o JMineOps
npm run discover
```

O script:

1. Conecta no SQL Server `192.168.17.15:1433`, banco `jmineops_uem`.
2. Lista todas as tabelas do schema `dbo` com suas colunas e tipos.
3. Mostra os 5 primeiros registros de:
   - `dbo.hour_detail_loads`
   - `dbo.custom_hour_detail_loads`
   - `dbo.equipments`
4. Imprime tudo no console **e** grava em `schema.json`.

> Execute na máquina que tem rota de rede até `192.168.17.15` (a sandbox da Lovable não enxerga essa rede interna).