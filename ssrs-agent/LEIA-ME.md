# Guia de Instalação do Agente SSRS (Windows Server)

Este agente foi criado para sincronizar automaticamente relatórios do SSRS para o Supabase.

## O que falta configurar

Você precisa configurar o arquivo `.env` antes de rodar o serviço.
1. Copie o arquivo `.env.example` para `.env`
2. Preencha as seguintes variáveis:
   - `SSRS_USERNAME`: Seu usuário do Active Directory/SSRS (ex: `dominio\\usuario` ou apenas `usuario`).
   - `SSRS_PASSWORD`: Sua senha do SSRS.
   - `SUPABASE_URL`: A URL do seu projeto Supabase (obtenha no painel do Supabase -> Project Settings -> API).
   - `SUPABASE_SERVICE_ROLE_KEY`: A chave `service_role` (obtenha no mesmo painel). Não use a chave `anon` pública.
   - `AGENT_TOKEN`: Um token qualquer que você inventar para proteger a rota `/health` caso precise depois.

## Comandos para executar no Servidor

Abra um terminal (PowerShell ou CMD) como **Administrador** na pasta `ssrs-agent` e execute:

1. Instalar as dependências do Node.js:
   ```cmd
   npm install
   ```

2. Testar o agente manualmente para garantir que não há erros de conexão:
   ```cmd
   npm run start
   ```
   *(Pressione Ctrl+C para parar após o teste)*

3. Instalar o serviço para rodar em background (inicia com o Windows):
   ```cmd
   npm run install-service
   ```

### Desinstalação
Se precisar remover o serviço:
```cmd
npm run uninstall-service
```
