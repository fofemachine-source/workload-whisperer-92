## Plano: Dashboard Hexagon/JMineOps 100% dados reais

### Arquitetura (mantida)
```
SQL Server (mina) → sqlserver-agent (Node, .env local) → Edge Function ingest-mineops → Supabase → Dashboard
```
Sem backend novo. Sem senha SQL no frontend. Dashboard lê só do Supabase via react-query + Realtime.

### 1. Supabase — novas tabelas (migration)
Espelham as 5 views do JMineOps. Todas com `data_referencia`, `equipamento`, `frota`, `frente`, `relatorio_origem='sqlserver-agent'`, `raw jsonb` (linha bruta do SQL), `created_at`, índices por data.

- `producao_view` ← `custom_vw_producao` (toneladas, hora)
- `viagens_acompanhamento` ← `custom_vw_acompanhamento_viagens` (viagens, origem, destino, ton)
- `tempo_estado` ← `custom_vw_tempo` (estado, minutos)
- `tempo_ciclo` ← `custom_vw_tempo_ciclo` (ciclo_min)
- `tempo_detalhado` ← `custom_vw_tempo_detalhado` (categoria, sub_estado, minutos)

RLS: leitura pública, escrita só `service_role`. GRANT explícito conforme regra do projeto. Publicação Realtime adicionada para todas.

### 2. Agente SQL (`sqlserver-agent`)
- Adicionar `src/queries.js` com 5 queries usando descoberta via `INFORMATION_SCHEMA.COLUMNS` antes de selecionar, normalizando nomes (data/equipamento/frota/tonelada/viagem/ciclo).
- Filtro padrão `CAST(<col_data> AS DATE) = CAST(GETDATE() AS DATE)` quando houver coluna de data; senão `TOP 5000` + log de aviso.
- `src/sync.js`: rodar as 5 queries a cada ciclo e POSTar no `ingest-mineops` com `kind: "producao_view" | "viagens" | "tempo" | "tempo_ciclo" | "tempo_detalhado"`.
- Novo endpoint local `GET /views/check` retornando quais views existem.
- Auto-reconexão a cada 1 min, sync a cada `SYNC_INTERVAL` (5 min).

### 3. Edge function `ingest-mineops`
Aceitar os 5 novos `kind`s, validar `AGENT_TOKEN`, fazer upsert/insert nas tabelas correspondentes, gravar em `sync_logs`. Sem mudar contratos existentes.

### 4. Frontend — remover tudo de meta
Apagar do dashboard `/` e `/producao`:
- card "META MENSAL"
- textos/labels "Meta", "Meta 85%", barras de meta, percentuais de meta
- mock `rankingCR` (lista fake CR2532 etc.) — substituir por dado real ou "Sem dados reais"
- frota fixa `FROTA_EX1200`/`FROTA_EX2500` zerada — manter só equipamentos que aparecerem nos dados reais

### 5. Frontend — novos cards (visual atual: preto, verde neon, amarelo)
Hooks novos: `useProducaoView`, `useViagens`, `useTempoEstado`, `useTempoCiclo`, `useTempoDetalhado` (react-query 30s + Realtime).

Layout do dashboard `/producao`:
1. **MINA** — acumulado real + projeção linear (`real_atual / h_decorridas * 24`); se <2h dados → "Sem projeção".
2. **RETALUDAMENTO** — idem, filtrando frente "retalud*". Hoje sem dado → "Sem projeção".
3. **PRODUÇÃO POR HORA** — gráfico de barras 24h de `producao_view`/`hour_detail_loads`.
4. **TPH ATUAL** — t/h do turno corrente, calculado.
5. **DISPONIBILIDADE FÍSICA POR FROTA** — % real por equipamento de `tempo_estado`/`tempo_detalhado` (sem barra de meta).
6. **UTILIZAÇÃO POR FROTA** — % real, sem meta.
7. **RANKING T/H TOP 8** — equipamentos reais com t/h calculado; vazio → "Sem dados reais".
8. **VIAGENS** — tabela/agrupado por equipamento/frota de `viagens_acompanhamento`.
9. **TEMPO DE CICLO** — média por equipamento/frota de `tempo_ciclo`.
10. **TEMPO DETALHADO** — empilhado por estado real (sem inventar categorias).

Topo: status SQL/Supabase, última atualização, botão "Atualizar agora", origem "SQL Server Hexagon/JMineOPS". Banner vermelho se última leitura > 15 min ou se erro do agente em `sync_logs`.

### 6. Limpeza
Remover componentes mortos: `MonitorAtualizacao`, `ValidacaoHexagonCard`, `DiagnosticoRetaludamento`, `FrentesBrutas` (já desmontado), banner duplicado. Manter só `AlertaSincronizacaoHexagon` consolidado.

### 7. Validação
- `npm run build` ok
- `/api/health` do agente retorna `GETDATE()`
- `/views/check` lista as 5 views
- Dashboard: zero `Math.random`, zero números fixos, zero "Meta", grep limpo
- Atualização a cada 30s sem piscar

### Detalhes técnicos
- Tabelas novas usam `ON CONFLICT` por `(data_referencia, equipamento, raw_hash)` para idempotência.
- Hooks reutilizam padrão de `useProducaoDiaria`.
- Empty state padronizado: componente `<SemDadosReais motivo="..." />`.
- Nenhuma alteração em `supabase/config.toml`, `client.ts`, `types.ts` manualmente — types regenerados após migration.
