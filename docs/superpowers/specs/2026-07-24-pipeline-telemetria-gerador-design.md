# Pipeline de Telemetria do Gerador Deep Sea 4520 MKII — Design

## Contexto

A empresa tem um grupo gerador com painel Deep Sea (DSE) 4520 MKII, acessado via gateway DSE 890
(Modbus TCP, IP `10.40.10.111:502`, Slave ID `10`, ver
`Documentação de Integração Telemetria Gerador Deep Sea 4520 MKII.txt`). Já existe um script
funcional (`gerador-monitor/index.js`) que lê os registradores, decodifica as particularidades do
mapa de memória (sensores ausentes retornam 32767/65535, tensões do gerador em blocos 32-bit
big-endian, acumulados de energia em blocos 16-bit) e imprime os dados no console.

Este é o primeiro de dois sub-projetos planejados:

1. **Pipeline de telemetria** (este documento): worker de coleta contínua → histórico em banco →
   dashboards no Grafana.
2. **Sistema web de operação** (spec futuro, separado): dashboard próprio, ligar/desligar o
   gerador remotamente, relatórios, e registro de manutenções (abastecimento, troca de óleo,
   aditivo, bateria, limpeza etc.).

## Objetivo deste sub-projeto

Transformar o script de leitura pontual existente em um worker de coleta contínua que grava o
histórico de telemetria em um banco TimescaleDB, para que o Grafana (já rodando em outro servidor
da empresa, junto com o Zabbix) possa consultar e exibir esses dados em dashboards.

## Arquitetura e fluxo de dados

```
Gateway DSE 890 (10.40.10.111:502, Modbus TCP, Slave ID 10)
        │
        ▼
Worker Node.js (container Docker, VM de produção da empresa)
  - loop contínuo a cada 10s (setTimeout recursivo, sem sobreposição de leituras)
  - lê e decodifica os registradores (lógica adaptada de gerador-monitor/index.js)
  - sucesso → INSERT em `leituras` (TimescaleDB)
  - falha (timeout/erro Modbus) → INSERT em `falhas_coleta` com a mensagem de erro
        ▼
TimescaleDB (container Docker, VM de produção, porta exposta na rede)
  - hypertable `leituras`, retention policy de 90 dias (reavaliar depois)
  - tabela `falhas_coleta`
        ▼
Grafana (servidor separado, fora do Docker, junto com o Zabbix)
  - datasource Postgres apontando para IP:porta da VM de produção
  - dashboards com queries SQL direto na hypertable
```

Notas de arquitetura:
- O worker passa a ser um serviço de longa duração (`restart: unless-stopped`), não mais um
  script que executa uma vez e sai.
- A VM de produção precisa ter rota de rede até `10.40.10.111` (mesma rede da empresa).
- A porta do TimescaleDB na VM precisa ficar acessível a partir do servidor onde roda o Grafana —
  liberação de rede/firewall entre os dois servidores é responsabilidade da infraestrutura da
  empresa, fora do escopo deste worker.

## Modelagem de dados

### Tabela `leituras` (hypertable, particionada por `time`)

| Coluna | Tipo | Observação |
|---|---|---|
| time | timestamptz | dimensão da hypertable |
| modo_operacao | text | Parado (Stop) / Automático / Manual / Teste |
| status_concessionaria | text | "Rede OK" / "FALHA NA REDE" (baseado em L1 e L2 > 100V) |
| motor_status | text | "Rodando" / "Parado" |
| rpm | smallint | 0 quando registrador retorna 65535 |
| temperatura_c | smallint (nullable) | `null` quando sensor ausente (32767/65535) |
| bateria_v | numeric(4,1) | |
| combustivel_pct | smallint | |
| rede_freq_hz | numeric(5,2) | |
| rede_volts_l1 | numeric(5,1) | |
| rede_volts_l2 | numeric(5,1) | |
| rede_volts_l3 | numeric(5,1) | |
| gerador_volts_l1 | numeric(6,1) | leitura 32-bit big-endian |
| gerador_volts_l2 | numeric(6,1) | leitura 32-bit big-endian |
| gerador_volts_l3 | numeric(6,1) | leitura 32-bit big-endian |
| gerador_amps_l1 | numeric(6,1) | leitura 32-bit big-endian |
| gerador_amps_l2 | numeric(6,1) | leitura 32-bit big-endian |
| gerador_amps_l3 | numeric(6,1) | leitura 32-bit big-endian |
| partidas | integer | |
| energia_kwh | numeric(10,1) | acumulado 16-bit |
| energia_kvarh | numeric(10,1) | acumulado 16-bit |
| energia_kvah | numeric(10,1) | acumulado 16-bit |

### Tabela `falhas_coleta`

| Coluna | Tipo |
|---|---|
| time | timestamptz |
| erro | text |

Retention: `add_retention_policy('leituras', INTERVAL '90 days')`, configurada desde o início.
Evolução futura possível (fora do escopo agora): continuous aggregates de médias horárias para
manter histórico de longo prazo sem reter a granularidade de 10s.

## Estrutura de código e deploy

Reorganização do `gerador-monitor` existente (mantendo a lógica de leitura já validada):

```
gerador-monitor/
  src/
    leitor.js       # lerGeradorCompleto() — lógica Modbus extraída do index.js atual
    db.js           # pool pg + insertLeitura() + insertFalha()
    index.js        # loop principal (setTimeout recursivo a cada 10s)
  db/
    init.sql        # CREATE TABLE leituras/falhas_coleta + create_hypertable + retention policy
  Dockerfile
  docker-compose.yml   # serviços: timescaledb + worker
  .env.example          # DB_HOST, DB_PASSWORD, GATEWAY_IP, INTERVALO_MS etc.
  package.json          # + dependência "pg"
```

Decisões técnicas:
- **Sem ORM** (nem Prisma nem Knex) — apenas o pacote `pg` com queries parametrizadas. Só há duas
  tabelas e inserts diretos; um ORM seria peso desnecessário para esse escopo.
- `db/init.sql` roda automaticamente na primeira subida do container
  `timescale/timescaledb:latest-pg16`, via mecanismo padrão `docker-entrypoint-initdb.d` da imagem
  — a hypertable e a retention policy já nascem configuradas.
- Configuração via variáveis de ambiente (`.env`): IP do gateway, credenciais do banco, intervalo
  de coleta — nada hardcoded no código.
- Volume Docker nomeado para persistir os dados do TimescaleDB entre restarts/deploys.

## Tratamento de erros

- **Falha de leitura Modbus** (timeout, gateway offline): captura o erro, grava
  `INSERT INTO falhas_coleta`, loga no console (visível via `docker logs`), e o loop segue
  normalmente no próximo ciclo — sem derrubar o worker.
- **Sensor ausente** (32767/65535): mantém a lógica já validada no script original — vira `null`
  no banco.
- **Container caindo por erro não tratado**: `restart: unless-stopped` no compose garante retomada
  automática.
- **Banco indisponível no momento do insert**: loga o erro e tenta novamente no próximo ciclo, sem
  derrubar o processo.

## Validação

Não há como aplicar TDD tradicional (depende de hardware real). Validação manual:

1. Rodar o worker contra o gateway real e conferir no `docker logs` que está lendo e inserindo a
   cada 10s.
2. Consultar `SELECT * FROM leituras ORDER BY time DESC LIMIT 5;` e comparar com o painel físico
   do DSE.
3. Derrubar a rede até o gateway propositalmente e confirmar que os erros vão para
   `falhas_coleta` sem o container cair.
4. Conectar o Grafana ao Postgres da VM e montar um painel simples (ex. RPM ao longo do tempo)
   para validar o fluxo ponta a ponta.

## Fora de escopo (fica para o próximo sub-projeto)

- Dashboard web próprio.
- Ligar/desligar o gerador remotamente (escrita Modbus).
- Relatórios.
- Registro de manutenções (abastecimento, troca de óleo, aditivo, bateria, limpeza etc.).
