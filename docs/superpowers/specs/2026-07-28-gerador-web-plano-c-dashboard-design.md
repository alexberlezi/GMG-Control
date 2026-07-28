# Sistema Web do Gerador — Plano C: Painel de Telemetria — Design

## Contexto

Terceira etapa do sub-projeto `gerador-web` (ver `docs/superpowers/specs/2026-07-24-gerador-web-fundacao-design.md`
para o histórico). Os Planos A (fundação) e B (RBAC + manutenções) estão concluídos e mergeados. O
app já tem, sem uso ainda:

- `src/lib/gerador-db.ts`: pool de conexão somente-leitura para o banco de telemetria
  (`GERADOR_DB_*` no `.env`), com `getUltimaLeitura()` já implementado (busca a linha mais recente
  de `leituras`, com todos os campos).
- Permissão `generator:read` (Plano B), já usada pela página de Manutenções — este painel reaproveita
  a mesma permissão, sem RBAC novo.
- Padrão de item de navegação por recurso em `dashboard-shell.tsx` (`resource: 'generator'`).

**Fora de escopo deste documento** (mantido conforme decidido no Plano A/fundação): operação remota
do gerador (ligar/desligar via escrita Modbus) e relatórios/exportação em PDF/Excel — ambos ficam
para specs futuras.

## Objetivo

Criar uma página `/dashboard/gerador` mostrando o status atual do gerador e um histórico recente de
saúde do motor (RPM, temperatura, bateria), lendo do banco de telemetria (TimescaleDB) já alimentado
pelo `gerador-monitor`.

## Arquitetura

```
src/app/dashboard/gerador/
  page.tsx              — Server Component, protegido por generator:read, lê searchParams.periodo
src/lib/gerador-db.ts
  getUltimaLeitura()     — já existe, sem mudanças
  getHistoricoGerador(periodo)  — NOVA: agrega rpm/temperatura_c/bateria_v via time_bucket()
src/components/dashboard/gerador/
  gerador-status-cards.tsx    — cards de valor atual (Client ou Server Component, sem estado)
  gerador-history-chart.tsx   — Client Component (Recharts), recebe os dados já agregados via props
  periodo-selector.tsx        — 3 links (6h/24h/7d) que navegam com ?periodo=
```

Sem API routes novas, sem Server Actions novas: a página é 100% Server Component, refeita a cada
navegação (troca de período = navegação normal via `<Link href="?periodo=24h">`, sem client fetch,
sem polling — decisão explícita do usuário para esta primeira versão).

### Consulta de histórico com `time_bucket`

`leituras` recebe uma linha a cada 10s (retenção 90 dias). Mandar os pontos brutos de um período de
24h (~8640 linhas) pro gráfico é desnecessário e pesado. `getHistoricoGerador(periodo)` usa a função
`time_bucket()` do TimescaleDB pra agregar por média, com largura de bucket fixa por período:

| Período | Largura do bucket | Pontos aproximados |
|---------|-------------------|---------------------|
| `6h`    | 1 minuto          | ~360                |
| `24h`   | 5 minutos         | ~288                |
| `7d`    | 1 hora            | ~168                |

`periodo` vindo da URL é validado contra uma lista fixa (`'6h' \| '24h' \| '7d'`, default `'24h'`)
antes de montar a query — nunca interpolado livremente.

```sql
SELECT time_bucket($1, time) AS bucket,
       avg(rpm) AS rpm,
       avg(temperatura_c) AS temperatura_c,
       avg(bateria_v) AS bateria_v
FROM leituras
WHERE time > now() - $2::interval
GROUP BY bucket
ORDER BY bucket ASC
```

(`$1`/`$2` = largura do bucket e janela total, ambos escolhidos a partir da lista fixa acima, nunca
a partir de input livre do usuário.)

## Componentes de UI

**Aviso de dado obsoleto**: se `getUltimaLeitura()` retornar `null`, ou `time` da última leitura for
mais antigo que 2 minutos (margem sobre o intervalo de coleta de 10s do `gerador-monitor`), a página
mostra um banner de aviso no topo ("Sem dados recentes do gerador — verifique a coleta"). Se houver
uma última leitura (mesmo antiga), os cards continuam mostrando esses valores, com o horário da
leitura visível, em vez de esconder o dado.

**Cards de status atual** (grid, mesmo padrão visual dos cards do `/dashboard` existente):
- Modo de operação (`modo_operacao`: Parado/Automático/Manual/Teste/Desconhecido)
- Status da concessionária (`status_concessionaria`: "Rede OK" em verde / "FALHA NA REDE" em
  vermelho)
- Status do motor (`motor_status`: Rodando/Parado, com indicador visual)
- Combustível (`combustivel_pct`)
- Tensões rede e gerador L1/L2/L3 (`rede_volts_l*`, `gerador_volts_l*`)
- Correntes gerador L1/L2/L3 (`gerador_amps_l*`)
- Frequência da rede (`rede_freq_hz`)
- Energia acumulada (`energia_kwh`, `energia_kvarh`, `energia_kvah`)
- Contador de partidas (`partidas`)

**Gráficos de histórico** (Recharts, `LineChart`): três séries — RPM, temperatura, bateria — cada
uma em seu próprio gráfico de linha, eixo X = tempo, com o seletor de período (6h/24h/7d) acima.

## Tratamento de erros

- Se a query ao banco de telemetria falhar (banco fora do ar, rede, etc.), a página captura o erro
  no Server Component e renderiza um estado de erro dedicado ("Não foi possível conectar ao banco de
  telemetria") em vez de propagar a exceção pro Error Boundary genérico do Next — esse banco roda
  numa VM separada (`10.40.3.15:5433`), fora do controle do `gerador-web`, então essa falha é
  esperada de acontecer eventualmente.
- `getHistoricoGerador` retornando lista vazia (sem leituras no período) é um estado válido, não um
  erro: o gráfico mostra "Sem dados no período selecionado" em vez de um gráfico vazio confuso.

## Dependências novas

- **Recharts** (`recharts`): única lib de gráficos do projeto até agora, adicionada via
  `npm install recharts`.

## Testes

Sem suíte de testes automatizados no `gerador-web` até agora (AuthForge não trouxe uma, e os Planos
A/B foram validados manualmente + revisão de código). Este plano segue o mesmo padrão: validação
manual via Docker local (dados reais do banco de telemetria de produção, lido em modo leitura) e
revisão de código no processo de subagent-driven-development, sem introduzir um framework de testes
novo só para esta feature.
