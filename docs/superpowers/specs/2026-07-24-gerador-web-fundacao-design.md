# Sistema Web do Gerador — Fundação (Dashboard, Manutenções, Relatórios) — Design

## Contexto

Este é o segundo dos dois sub-projetos planejados para o sistema do gerador Deep Sea 4520 MKII:

1. **Pipeline de telemetria** (concluído — ver
   `docs/superpowers/specs/2026-07-24-pipeline-telemetria-gerador-design.md`): worker Node.js
   coleta dados via Modbus TCP e grava em TimescaleDB na VM de produção (`10.40.3.15`, banco
   `gerador`, porta `5433`). Grafana já consome esse banco para dashboards.
2. **Sistema web** (este documento): dashboard próprio, registro de manutenções e relatórios.
   A parte de **operação remota (ligar/desligar o gerador via escrita Modbus)** foi
   deliberadamente deixada fora deste documento — é um sub-projeto separado, por envolver
   comando de equipamento físico e exigir investigação e validação de segurança próprias
   (nunca testamos escrita Modbus neste painel).

O usuário já possui um starter kit próprio, **AuthForge** (`C:\Users\alexb\OneDrive\Projetos\Authforge`),
um sistema de IAM (Identity and Access Management) self-hosted em Next.js 16 + Prisma 7 +
PostgreSQL, com autenticação multi-método (e-mail/senha, Magic Link, OAuth, LDAP, 2FA), RBAC
granular (`recurso:ação`), audit log, sessões revogáveis e white-label já prontos e documentados
(`README.md`, `ARCHITECTURE.md`, `CODEBASE.md`). A decisão validada com o usuário foi usar o
AuthForge como base deste sistema, em vez de começar do zero.

## Objetivo deste sub-projeto

Criar `gerador-web`, uma cópia do AuthForge estendida com:
- Dashboard de telemetria do gerador (lendo o banco já existente do pipeline).
- CRUD de registros de manutenção (abastecimento, troca de óleo, aditivo, bateria, limpeza,
  defeitos/avarias encontrados), com anexos de foto/comprovante.
- Relatórios de histórico de manutenção e de operação do gerador, com gráficos comparativos por
  período e exportação em PDF/Excel.
- RBAC estendido com permissões específicas do domínio do gerador.

## Arquitetura geral

```
gerador-web/  (cópia do AuthForge, em C:\Users\alexb\OneDrive\Projetos\Gerador\gerador-web)
  - Next.js 16 (App Router) + Prisma 7 + PostgreSQL — dados próprios: usuários, permissões,
    sessões, audit log, registros de manutenção
  - Roda em container Docker próprio, na mesma VM de produção (10.40.3.15) onde já rodam o
    worker e o TimescaleDB do gerador
  - Banco próprio "gerador_web": instância/container Postgres separada da do TimescaleDB,
    dedicada aos dados do AuthForge (usuários, RBAC, manutenções)
  - Leitura de telemetria: pool "pg" simples, somente leitura, apontando para o banco "gerador"
    já existente (10.40.3.15:5433) — mesmo padrão sem ORM usado no worker de coleta. O Prisma
    fica restrito aos dados próprios do AuthForge; a telemetria nunca é escrita por este app.
```

Notas de arquitetura:
- Dois bancos Postgres distintos na mesma VM: um para telemetria (já existe, gerido pelo
  worker/TimescaleDB), outro novo para o AuthForge — mantém os domínios de dados separados e
  evita qualquer risco de o app web escrever acidentalmente na tabela `leituras`.
- Porta de exposição do container `web` fica a definir no momento do deploy (evitando os
  conflitos de porta já vistos no worker); o roteamento por domínio via Nginx Proxy Manager
  (já rodando na VM) é configurado depois, fora do escopo deste documento.

## Autenticação e RBAC

Reaproveita integralmente o que o AuthForge já tem:
- **Login inicial**: e-mail e senha (LDAP/AD e OAuth continuam disponíveis, configuráveis depois
  pelo painel admin, sem alteração de código).
- **E-mail** (convites, reset de senha): configurado depois pelo painel admin (SMTP ou Resend); o
  Setup Wizard cria a conta Owner sem depender de e-mail.

Novas permissões granulares (`recurso:ação`), seguindo o padrão já existente
(`src/lib/permissions.ts` / `checkPermission()`):

| Permissão | Uso |
|---|---|
| `gerador:visualizar` | Ver dashboard de telemetria e relatórios |
| `manutencao:criar` | Registrar nova manutenção |
| `manutencao:editar` | Editar/corrigir um registro existente |
| `manutencao:excluir` | Remover um registro (ex: lançamento errado) |
| `relatorios:exportar` | Baixar relatórios em PDF/Excel |

O Owner mantém permissão total implícita, como hoje. Grupos (Roles) como "Operador",
"Manutenção", "Gestor" podem ser criados depois pelo painel, distribuindo essas permissões
conforme quem for usar o sistema — não é necessário decidir isso agora.

## Modelagem de dados — Manutenções

Novo schema Prisma, adicionado ao `prisma/schema.prisma` do AuthForge:

### `RegistroManutencao`

| Campo | Tipo | Observação |
|---|---|---|
| id | String (cuid) | |
| tipo | Enum | `ABASTECIMENTO`, `TROCA_OLEO`, `ADITIVO`, `BATERIA`, `LIMPEZA`, `DEFEITO_AVARIA`, `OUTRO` |
| dataHora | DateTime | Quando a manutenção/ocorrência aconteceu |
| responsavelId | String (FK → `User`) | Quem registrou (via sessão logada) |
| quantidade | Decimal? | Litros de óleo, combustível etc. — opcional, nem todo tipo usa |
| unidadeMedida | String? | "L", "un", etc. |
| custo | Decimal? | Valor gasto (opcional) |
| observacoes | Text? | Campo livre |
| criadoEm / atualizadoEm | DateTime | Auditoria padrão |

### `AnexoManutencao` (1:N com `RegistroManutencao`)

| Campo | Tipo |
|---|---|
| id | String (cuid) |
| registroManutencaoId | FK |
| caminhoArquivo | String (`public/uploads/manutencoes/...`) |
| criadoEm | DateTime |

Reaproveita o padrão de upload em disco já usado em `src/actions/upload.ts` (logos, avatares) —
mesmo mecanismo (`fs/promises`, diretório dentro de `public/uploads/`), só uma nova subpasta
`manutencoes/`.

O tipo `DEFEITO_AVARIA` cobre o registro de problemas encontrados (não só manutenção programada);
os anexos servem tanto para comprovante (nota fiscal) quanto para foto do defeito/avaria.

Toda criação/edição/exclusão passa pelo `logAudit()` já existente no AuthForge, então fica
registrado automaticamente quem alterou o quê — sem trabalho extra de auditoria.

## Relatórios

- **Histórico de manutenções**: tela com filtros (período, tipo, responsável), consultando
  `RegistroManutencao` via Prisma.
- **Resumo de operação do gerador**: consulta agregada sob demanda direto na tabela `leituras`
  (via o pool `pg` de leitura) — sem tabela pré-agregada, dado o volume (leituras a cada 10s,
  retenção de 90 dias). Métricas: horas de motor rodando, número de partidas no período, consumo
  médio de combustível, energia gerada (kWh) no período.
- **Gráficos com comparativo por período**: os mesmos dados agregados, exibidos com uma
  biblioteca leve de gráficos (Recharts, compatível com React/Next.js), comparando período atual
  vs. anterior (ex: mês atual vs. mês passado).
- **Exportação PDF/Excel**: gerada sob demanda via Server Action — Excel com `exceljs`, PDF com
  `@react-pdf/renderer` (ambas sem dependência de navegador headless).

## Deploy (Docker)

```
gerador-web/
  (código copiado do AuthForge, com as adições deste documento)
  Dockerfile              # já existe no AuthForge (multi-stage, Next.js standalone) — reaproveitado
  docker-compose.yml      # novo: serviço "web" + serviço "postgres-web" (banco próprio do AuthForge)
  .env.example            # DATABASE_URL (postgres-web), AUTH_SECRET, GERADOR_DB_* (conexão leitura), NEXT_PUBLIC_APP_URL
```

- Volume nomeado para o Postgres do AuthForge (usuários, permissões, manutenções), no mesmo
  padrão do `timescaledb_data` do worker.
- Volume nomeado para `public/uploads`, persistindo anexos de manutenção entre rebuilds do
  container.
- Variáveis de ambiente com host/porta/usuário do banco `gerador` já existente
  (`10.40.3.15:5433`) para a conexão de leitura de telemetria — somente leitura, nunca escrita.

## Documentação

Mantida e estendida junto com o código, seguindo o padrão que o AuthForge já usa:
- `README.md` — setup local e configuração.
- `ARCHITECTURE.md` — decisões técnicas (já existe no AuthForge; estendido com as decisões deste
  documento: banco de telemetria separado, RBAC estendido, relatórios).
- `CODEBASE.md` — mapa de pastas e dependências (idem, estendido com as novas actions/rotas).

Isso cobre a documentação completa pedida para eventuais manutenções futuras do sistema.

## Fora de escopo (fica para uma spec separada)

- Ligar/desligar o gerador remotamente (escrita Modbus) — requer investigação de escrita Modbus
  (nunca testada neste painel) e uma conversa de design própria focada em segurança
  (confirmações, interlocks, quem pode operar).
