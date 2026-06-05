# MineOPS SSRS Agent

Agente local em Node.js que roda **dentro da rede da mina** e sincroniza
relatórios do SQL Server Reporting Services (SSRS) do Hexagon MineOPS para
a Lovable Cloud a cada N minutos.

```
SSRS (192.168.17.15)  ──NTLM──▶  Agente Node.js  ──HTTPS+Bearer──▶  Edge Function Lovable  ──▶  Supabase  ──▶  Dashboard
```

## Pré-requisitos

- Windows Server (ou Windows 10/11) com acesso de rede ao SSRS
- Node.js 18 ou superior
- Conta de domínio com permissão de leitura no relatório SSRS

## Instalação

1. Copie esta pasta `agent/` para o servidor (ex: `C:\mineops-agent`).
2. No painel da Lovable, acesse **/admin/ssrs**, crie um **token** e copie o valor (aparece **uma única vez**).
3. Duplique `.env.example` para `.env` e preencha:
   - `SSRS_URL`, `SSRS_REPORT_PATH`
   - `SSRS_USERNAME` (formato `DOMINIO\\usuario`), `SSRS_PASSWORD`, `SSRS_DOMAIN`
   - `AGENT_TOKEN` com o token gerado
   - `AGENT_NAME` para identificar este servidor
4. Instale dependências:

   ```cmd
   npm install
   ```

5. Teste em primeiro plano:

   ```cmd
   npm start
   ```

   Você deve ver linhas `[info] Sincronizando relatório: producao_diaria` e,
   no painel **/admin/integracao**, o status mudar para **ONLINE**.

## Rodar como serviço Windows (automático no boot)

Abra um **CMD como Administrador** dentro da pasta `agent/` e execute:

```cmd
npm run install-service
```

Para remover:

```cmd
npm run uninstall-service
```

Logs ficam em `C:\mineops-agent\daemon\` quando rodando como serviço.

## Adicionar novos relatórios

1. Crie `src/reports/<novo-relatorio>.js` exportando um objeto com `id`,
   `defaultPath`, `format` e `mapRow(row)`.
2. Registre em `src/reports/index.js`.
3. Reinicie o serviço.

Cada relatório é gravado na tabela `producao_diaria` com `relatorio_origem`
correspondente ao `id`, então fica isolado por tipo.

## Ajustar mapeamento de colunas

O nome das colunas no CSV depende de como o relatório foi publicado no
SSRS. Para descobrir, baixe uma vez manualmente:

```
http://192.168.17.15/ReportServer?%2FJMineOPS%2FRelatorios_HOMOLOGACAO%2FProducao+Diaria&rs:Command=Render&rs:Format=CSV
```

Abra o CSV e ajuste os nomes de coluna em `src/reports/producao-diaria.js`.

## Segurança

- O token do agente é **hash SHA-256** no banco — só você tem a versão em texto.
- Pode revogar a qualquer momento em **/admin/ssrs**.
- A senha do SSRS **nunca trafega pela internet** — fica só no `.env` local.