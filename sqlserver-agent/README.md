# MineOPS SQL Server Agent (v2)

Agente Node.js que conecta **diretamente** ao SQL Server do Hexagon MineOPS,
calcula os KPIs operacionais e envia para a Edge Function
`ingest-mineops` da Lovable Cloud.

```
SQL Server (192.168.17.15:1433)
        │  (mssql + TDS)
        ▼
   Node Agent  ── HTTPS Bearer ──▶  Edge Function ingest-mineops
                                              │
                                              ▼
                                       Supabase (producao_diaria)
                                              │
                                              ▼
                                         Dashboard MineOPS
```

**SSRS foi descontinuado.** Não há mais `axios-ntlm`, `ReportServer`,
`SSRS_URL`, `SSRS_REPORT_PATH`, `SSRS_USERNAME` ou `SSRS_PASSWORD`.

## Pré-requisitos
- Windows/Linux com Node.js 18+
- Acesso de rede TCP a `192.168.17.15:1433`
- Usuário SQL com permissão de leitura em:
  - `dbo.hour_detail_loads`
  - `dbo.custom_hour_detail_loads`
  - `dbo.equipments`
  - função `dbo.states_for_interval`

## Instalação
```cmd
cd sqlserver-agent
copy .env.example .env
:: edite .env conforme necessário
npm install
npm start
```

Health-check: `http://localhost:3000/health`

## Rodar como serviço Windows
```cmd
npm run install-service
npm run uninstall-service
```

## KPIs calculados e enviados
| KPI | Origem |
|---|---|
| Toneladas por Hora | `SUM(tons)/horas` (por turno) |
| Produção do Turno | `SUM(tons)` agrupado por data+turno |
| Carga Operando | contagem em `hour_detail_loads.equipment_type='LOAD'` |
| Transporte Operando | contagem em `equipment_type='TRANSPORT'` |
| Disponibilidade Física (DF) | `horas_disp / horas_totais` em `states_for_interval` |
| Utilização (UT) | `horas_operando / horas_disp` em `states_for_interval` |
| Equipamentos Disponíveis | `equipments.is_available = 1` |
| Equipamentos Utilizados | `equipments.status LIKE '%OP%'` |
| Meta Mensal | variável `META_MENSAL` do `.env` |
| Acumulado do Dia/Mês | soma `tons` no período corrente |
| Projetado do Mês | `acumulado / dias_corridos * dias_mes` |

## Variáveis de ambiente (`.env`)
| Chave | Descrição |
|---|---|
| `SQL_SERVER` | IP/host do SQL Server (ex: 192.168.17.15) |
| `SQL_PORT` | Porta TDS (1433) |
| `SQL_DATABASE` | `jmineops_uem` |
| `SQL_USER` / `SQL_PASSWORD` | Credenciais SQL |
| `SQL_ENCRYPT` | `false` para rede interna |
| `SQL_TRUST_SERVER_CERTIFICATE` | `true` |
| `INGEST_URL` | URL da Edge Function ingest-mineops |
| `AGENT_TOKEN` | Bearer token (`UEM_MINEOPS_2026`) |
| `AGENT_NAME` | Identificador deste agente |
| `SYNC_INTERVAL` | Segundos entre sincronizações |
| `META_MENSAL` | Meta de toneladas no mês |
| `PORT` | Porta do health-check HTTP local |

## Ajuste de schema
Se nomes de colunas no MineOPS desta planta divergirem (ex: `tonelagem`
em vez de `tons`), edite apenas `src/sync.js` — as queries estão
isoladas nas funções `queryLoads`, `queryEquipments` e `queryStates`.