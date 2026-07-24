# Gerador Web — Plano A: Fundação (cópia do AuthForge, banco, deploy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `gerador-web` a partir de uma cópia do AuthForge (`C:\Users\alexb\OneDrive\Projetos\Authforge`), integrado ao repositório Gerador, com banco Postgres próprio, conexão de leitura ao banco de telemetria do gerador, e deploy funcional via Docker Compose — pronto para as próximas fases (RBAC/manutenções, dashboard/relatórios) construírem em cima.

**Architecture:** Cópia direta do código do AuthForge (Next.js 16 + Prisma 7 + PostgreSQL), sem herdar o histórico git dele — vira parte do repositório Gerador, ao lado do `gerador-monitor`. Dois bancos Postgres na mesma VM de produção: um novo (`postgres-web`, dados do AuthForge) e o já existente (`gerador`/TimescaleDB, telemetria) — a leitura de telemetria usa um `pg.Pool` simples, somente leitura, sem ORM.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7 + `@prisma/adapter-pg`, PostgreSQL, TypeScript, `pg` (leitura de telemetria), Docker + Docker Compose.

## Global Constraints

- gerador-web usa banco Postgres **próprio** (`postgres-web`), completamente separado do banco de
  telemetria (`gerador`/TimescaleDB) — nunca escreve na tabela `leituras` ou `falhas_coleta`.
- Conexão de leitura de telemetria: `pg.Pool` puro, sem Prisma, somente leitura — mesmo padrão
  usado no worker `gerador-monitor`.
- O AuthForge **não tem framework de testes unitários** (Jest/Vitest) — só os scripts de gate
  `test:actions`/`test:routes` (rodados via `npm run build`) e nenhum outro teste automatizado.
  Este plano **não introduz** um framework de testes novo; a verificação de código novo é feita
  por checagem manual/smoke test ao vivo, documentada em cada task.
- `.agents/` (framework de tooling de outro agente, não relacionado a este projeto) e os scripts
  soltos `replace_ips.js`/`replace_ips.py` **não são copiados** para `gerador-web`.
- `gerador-web/.gitignore` é uma cópia do `.gitignore` do AuthForge (nested, respeitado pelo git
  automaticamente para tudo dentro de `gerador-web/`) — não mexe no `.gitignore` raiz do
  repositório Gerador.
- Segredos reais (`.env`) nunca são commitados — mesma convenção do `gerador-monitor`.
- Todo valor de configuração (portas, credenciais, host do banco de telemetria) vem de variáveis
  de ambiente, nunca hardcoded no código.

---

### Task 1: Copiar o AuthForge para gerador-web e integrar no repositório Gerador

**Files:**
- Create: `gerador-web/` (cópia seletiva do AuthForge — ver lista de itens no Step 1)
- Modify: `gerador-web/package.json` (campo `name`)

**Interfaces:** Nenhuma nova — esta task só estabelece a base de código.

- [ ] **Step 1: Copiar os arquivos do AuthForge, excluindo o que não deve ir**

Rodar de dentro de `C:\Users\alexb\OneDrive\Projetos\Gerador`:

```bash
mkdir -p gerador-web
cd /c/Users/alexb/OneDrive/Projetos/Authforge
for item in .gitignore AGENTS.md ARCHITECTURE.md CLAUDE.md CODEBASE.md README.md docs \
            eslint.config.mjs next.config.ts package-lock.json package.json postcss.config.mjs \
            prisma prisma.config.ts public scripts seed-permissions.js src tsconfig.json; do
  cp -r "$item" "/c/Users/alexb/OneDrive/Projetos/Gerador/gerador-web/$item"
done
```

Confirmar que os itens excluídos (`.git`, `.env`, `.next`, `node_modules`, `.agents`,
`next-env.d.ts`, `tsconfig.tsbuildinfo`, `replace_ips.js`, `replace_ips.py`) **não** foram
copiados:

```bash
ls /c/Users/alexb/OneDrive/Projetos/Gerador/gerador-web
```

Expected: lista contém exatamente os 19 itens copiados no comando acima — nada mais.

- [ ] **Step 2: Renomear o pacote**

Editar `gerador-web/package.json`, campo `"name"`:

```json
  "name": "gerador-web",
```

(era `"authforge"` — todo o resto do arquivo permanece igual nesta task; dependências serão
ajustadas nas próximas tasks conforme necessário.)

- [ ] **Step 3: Instalar dependências e confirmar que não há erro**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador/gerador-web
npm install
```

Expected: `npm install` conclui sem erro (warnings são aceitáveis). Isso NÃO sobe o app ainda —
só confirma que o `package.json`/`package-lock.json` copiados são válidos.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador
git add gerador-web
git status --short
```

Confirmar no `git status` que `gerador-web/node_modules` **não** aparece (deve estar coberto
pelo `gerador-web/.gitignore` copiado no Step 1). Se aparecer, pare e não commite — revise o
`.gitignore` antes de continuar.

```bash
git commit -m "$(cat <<'EOF'
Add gerador-web: base copiada do AuthForge

Cópia seletiva do starter kit AuthForge (Next.js 16 + Prisma 7 + IAM
completo: auth multi-método, RBAC, audit log) como fundação do sistema
web do gerador. Histórico git do AuthForge não foi trazido — vira
parte do repositório Gerador, ao lado do gerador-monitor.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Dockerfile e .dockerignore

**Files:**
- Create: `gerador-web/Dockerfile`
- Create: `gerador-web/.dockerignore`
- Create: `gerador-web/docker-entrypoint.sh`

**Interfaces:**
- Produces: imagem Docker que builda o Next.js (`npm run build`, que já roda os gates
  `test:actions`/`test:routes` do AuthForge) e, no start do container, roda
  `npx prisma migrate deploy` antes de subir o servidor Next.js.

- [ ] **Step 1: Criar o `.dockerignore`**

```
node_modules
.next
.git
.env
*.log
```

Salvar em `gerador-web/.dockerignore`.

- [ ] **Step 2: Criar o entrypoint que roda as migrations antes do start**

```sh
#!/bin/sh
set -e
npx prisma migrate deploy
exec npm start
```

Salvar em `gerador-web/docker-entrypoint.sh`.

- [ ] **Step 3: Criar o Dockerfile (multi-stage)**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
```

Salvar em `gerador-web/Dockerfile`.

Nota: o AuthForge documenta "Next.js standalone output" como estratégia de deploy em
`ARCHITECTURE.md`, mas isso nunca foi implementado de fato (não havia Dockerfile nem
`output: 'standalone'` configurado). Este Dockerfile usa `next build`/`next start` com
`node_modules` completo copiado entre estágios — mais simples e robusto, evita as
particularidades de rastreamento de arquivos do modo standalone. Isso será refletido na Task 5
(atualização de `ARCHITECTURE.md`).

- [ ] **Step 4: Build local da imagem (sem subir ainda) para validar que o Dockerfile builda**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador/gerador-web
docker build -t gerador-web:test .
```

Expected: build conclui com sucesso (a etapa `RUN npm run build` executa os gates
`test:actions`/`test:routes` do AuthForge como parte do build — se algum Server Action não
estiver protegida por `withAuth`/`withPermission`, o build falha aqui, o que é o comportamento
esperado/desejado, não um bug deste Dockerfile).

Se o build falhar por causa de código do AuthForge em si (não do Dockerfile), reporte como
BLOCKED — não modifique código de produto do AuthForge para "fazer passar" sem entender a causa.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador
git add gerador-web/Dockerfile gerador-web/.dockerignore gerador-web/docker-entrypoint.sh
git commit -m "$(cat <<'EOF'
Add Dockerfile for gerador-web (multi-stage, migrate deploy on start)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: docker-compose.yml, .env.example, e validação local

**Files:**
- Create: `gerador-web/docker-compose.yml`
- Modify: `gerador-web/.env.example` (substituído pelo conteúdo abaixo — específico do
  gerador-web, não mais o do AuthForge genérico)

**Interfaces:**
- Consumes: imagem Docker da Task 2.
- Produces: stack local rodando (`postgres-web` + `web`) acessível em `http://localhost:3001`,
  exibindo o Setup Wizard do AuthForge na primeira execução.

- [ ] **Step 1: Substituir o `.env.example`**

```
# ═══════════════════════════════════════
# BANCO DE DADOS DO GERADOR-WEB (próprio, separado da telemetria)
# ═══════════════════════════════════════
POSTGRES_DB=gerador_web
POSTGRES_USER=gerador_web
POSTGRES_PASSWORD=CHANGE_ME_BEFORE_DEPLOY

# ═══════════════════════════════════════
# AUTH
# ═══════════════════════════════════════
# Gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=CHANGE_ME_GENERATE_32_BYTES_HEX

# ═══════════════════════════════════════
# APP
# ═══════════════════════════════════════
NEXT_PUBLIC_APP_URL=http://localhost:3001
WEB_HOST_PORT=3001

# ═══════════════════════════════════════
# BANCO DE TELEMETRIA DO GERADOR (somente leitura — já existente, worker gerador-monitor)
# ═══════════════════════════════════════
GERADOR_DB_HOST=10.40.3.15
GERADOR_DB_PORT=5433
GERADOR_DB_NAME=gerador
GERADOR_DB_USER=gerador
GERADOR_DB_PASSWORD=CHANGE_ME
```

Salvar em `gerador-web/.env.example`, substituindo o conteúdo herdado do AuthForge (que tinha
seções de e-mail/OAuth/LDAP/Turnstile — esses continuam configuráveis depois pelo painel admin,
então não precisam de variável de ambiente aqui; ver `README.md` do AuthForge).

- [ ] **Step 2: Criar o `docker-compose.yml`**

```yaml
services:
  postgres-web:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_web_data:/var/lib/postgresql/data

  web:
    build: .
    restart: unless-stopped
    depends_on:
      - postgres-web
    ports:
      - "${WEB_HOST_PORT:-3001}:3000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres-web:5432/${POSTGRES_DB}
      AUTH_SECRET: ${AUTH_SECRET}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
      GERADOR_DB_HOST: ${GERADOR_DB_HOST}
      GERADOR_DB_PORT: ${GERADOR_DB_PORT}
      GERADOR_DB_NAME: ${GERADOR_DB_NAME}
      GERADOR_DB_USER: ${GERADOR_DB_USER}
      GERADOR_DB_PASSWORD: ${GERADOR_DB_PASSWORD}
    volumes:
      - web_uploads:/app/public/uploads

volumes:
  postgres_web_data:
  web_uploads:
```

Salvar em `gerador-web/docker-compose.yml`.

- [ ] **Step 3: Subir localmente e validar**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador/gerador-web
cp .env.example .env
```

Editar o `.env` recém-criado: gerar um `AUTH_SECRET` real com
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` e definir um
`POSTGRES_PASSWORD` real (qualquer senha forte serve para o ambiente local). Deixar
`GERADOR_DB_PASSWORD` como está por enquanto — não é necessário para esta validação (só será
testado na Task 4).

```bash
docker compose up -d --build
sleep 15
docker compose logs web --tail=40
```

Expected: logs mostram `prisma migrate deploy` aplicando as migrations sem erro, seguido do
Next.js reportando que está pronto (`✓ Ready` ou equivalente).

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001
```

Expected: código HTTP `200` ou `307` (redirecionamento para `/setup`, já que é a primeira
execução) — qualquer um dos dois confirma que o app está respondendo.

- [ ] **Step 4: Parar os containers (não deixar rodando sem necessidade)**

```bash
docker compose down
```

(O volume `postgres_web_data` permanece — não é `docker compose down -v` — então dá para subir
de novo depois sem perder o setup, se for útil para as próximas tasks.)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador
git add gerador-web/docker-compose.yml gerador-web/.env.example
git commit -m "$(cat <<'EOF'
Add docker-compose.yml for gerador-web (own Postgres + web container)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(O `.env` real criado no Step 3 não é commitado — já está coberto pelo `.gitignore` copiado na
Task 1.)

---

### Task 4: Cliente de leitura da telemetria (read-only)

**Files:**
- Create: `gerador-web/src/lib/gerador-db.ts`
- Create: `gerador-web/scripts/check-gerador-db.ts`

**Interfaces:**
- Produces:
  - `geradorDb: pg.Pool` — pool de conexão somente leitura ao banco de telemetria, configurado
    via `GERADOR_DB_HOST/PORT/NAME/USER/PASSWORD`.
  - `getUltimaLeitura(): Promise<object | null>` — retorna a linha mais recente da tabela
    `leituras` (todas as 22 colunas), ou `null` se a tabela estiver vazia. Será consumida pelas
    telas de dashboard na próxima fase (Plano C).

- [ ] **Step 1: Criar o módulo de conexão**

```typescript
// gerador-web/src/lib/gerador-db.ts
import pg from 'pg';

const globalForGeradorDb = globalThis as unknown as {
  geradorDbPool: pg.Pool | undefined;
};

function createGeradorDbPool() {
  return new pg.Pool({
    host: process.env.GERADOR_DB_HOST,
    port: Number(process.env.GERADOR_DB_PORT || 5432),
    database: process.env.GERADOR_DB_NAME,
    user: process.env.GERADOR_DB_USER,
    password: process.env.GERADOR_DB_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export const geradorDb = globalForGeradorDb.geradorDbPool ?? createGeradorDbPool();

if (process.env.NODE_ENV !== 'production') {
  globalForGeradorDb.geradorDbPool = geradorDb;
}

export async function getUltimaLeitura() {
  const { rows } = await geradorDb.query(
    `SELECT time, modo_operacao, status_concessionaria, motor_status, rpm, temperatura_c,
            bateria_v, combustivel_pct, rede_freq_hz, rede_volts_l1, rede_volts_l2, rede_volts_l3,
            gerador_volts_l1, gerador_volts_l2, gerador_volts_l3, gerador_amps_l1,
            gerador_amps_l2, gerador_amps_l3, partidas, energia_kwh, energia_kvarh, energia_kvah
     FROM leituras ORDER BY time DESC LIMIT 1`
  );
  return rows[0] ?? null;
}
```

Este módulo segue o mesmo padrão singleton de `src/lib/db.ts` (Prisma), mas usa `pg.Pool`
diretamente — sem Prisma, sem migrations, somente leitura.

- [ ] **Step 2: Criar o script de verificação manual (não é teste automatizado — ver Global Constraints)**

```typescript
// gerador-web/scripts/check-gerador-db.ts
import 'dotenv/config';
import { getUltimaLeitura, geradorDb } from '../src/lib/gerador-db';

async function main() {
  const leitura = await getUltimaLeitura();
  console.log('Última leitura da telemetria:', leitura);
  await geradorDb.end();
}

main().catch((erro) => {
  console.error('Falha ao conectar no banco de telemetria:', erro.message);
  process.exit(1);
});
```

- [ ] **Step 3: Rodar a verificação contra o banco de telemetria real**

Preencher `GERADOR_DB_PASSWORD` no `.env` local (Task 3) com a senha real do banco `gerador` na
VM de produção (a mesma configurada em `gerador-monitor/.env` no servidor `10.40.3.15`; não
está em nenhum arquivo deste repositório — pedir ao usuário se necessário).

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador/gerador-web
npx tsx scripts/check-gerador-db.ts
```

Expected: imprime a última leitura da tabela `leituras` (objeto com `time`, `modo_operacao`,
`rpm` etc.) e termina sem erro. Isso confirma que esta máquina consegue alcançar
`10.40.3.15:5433` e que as credenciais estão corretas — mesma verificação de rede já validada
manualmente durante o Plano A do `gerador-monitor`.

Se falhar por timeout de rede, é esperado quando rodado fora da rede da empresa/VPN — reporte
como DONE_WITH_CONCERNS explicando que a conectividade só é validável a partir de uma máquina
com rota até `10.40.3.15`, e que o código em si (queries, parsing) foi revisado manualmente.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador
git add gerador-web/src/lib/gerador-db.ts gerador-web/scripts/check-gerador-db.ts
git commit -m "$(cat <<'EOF'
Add read-only telemetry DB client (gerador-db.ts)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Atualizar documentação

**Files:**
- Modify: `gerador-web/README.md`
- Modify: `gerador-web/ARCHITECTURE.md`
- Modify: `gerador-web/CODEBASE.md`

**Interfaces:** Nenhuma — apenas documentação.

- [ ] **Step 1: Atualizar `README.md`**

Adicionar uma seção no topo (logo após o título/descrição existente do AuthForge, antes da seção
"Configuração Local"):

```markdown
## Sobre este projeto (gerador-web)

Este projeto é uma cópia do starter kit [AuthForge](../../../Authforge) (auth, RBAC, audit log
prontos), estendida para operar como o sistema web do gerador Deep Sea 4520 MKII: dashboard de
telemetria, registro de manutenções e relatórios. É o segundo dos dois sub-projetos do
repositório `Gerador` — o primeiro é o `gerador-monitor` (worker de coleta de telemetria).

Duas conexões de banco distintas:
- `DATABASE_URL` — banco próprio deste app (usuários, permissões, manutenções), via Prisma.
- `GERADOR_DB_*` — banco de telemetria já existente (`leituras`, `falhas_coleta`), somente
  leitura, via `pg.Pool` direto (`src/lib/gerador-db.ts`), sem Prisma.

Deploy: `docker compose up -d --build` (ver `docker-compose.yml`) — sobe este app e seu banco
próprio (`postgres-web`) na mesma VM onde já rodam o `gerador-monitor` e o TimescaleDB.
```

- [ ] **Step 2: Atualizar `ARCHITECTURE.md`**

Na seção "7. Deploy", substituir a linha:

```markdown
- **Docker Standalone**: Next.js standalone output + multi-stage Dockerfile
```

por:

```markdown
- **Docker (gerador-web)**: multi-stage Dockerfile com `node_modules` completo copiado entre
  estágios (não usa `output: 'standalone'`) — mais simples de manter, evita as particularidades
  de rastreamento de arquivos do modo standalone. O `docker-entrypoint.sh` roda
  `prisma migrate deploy` antes de iniciar o servidor Next.js a cada subida do container.
```

Adicionar ao final do arquivo uma nova seção:

```markdown
---

## 8. Integração com a Telemetria do Gerador (gerador-web)

- Banco de telemetria (`leituras`, `falhas_coleta`) é populado pelo worker `gerador-monitor`,
  externo a este app — este app nunca escreve nele.
- Leitura via `src/lib/gerador-db.ts`: `pg.Pool` dedicado, configurado por
  `GERADOR_DB_HOST/PORT/NAME/USER/PASSWORD`, completamente separado do `db.ts` (Prisma) usado
  para os dados próprios deste app.
- Verificação manual de conectividade: `npx tsx scripts/check-gerador-db.ts`.
```

- [ ] **Step 3: Atualizar `CODEBASE.md`**

Na tabela de `lib/`, adicionar a linha:

```markdown
| `gerador-db.ts` | Pool `pg` somente leitura para o banco de telemetria do gerador (`leituras`, `falhas_coleta`) — separado do Prisma |
```

Adicionar uma nova seção após a tabela de `lib/auth/`:

```markdown
### `scripts/` — Utilitários de linha de comando (gerador-web)
| Arquivo | Responsabilidade |
|---------|-----------------|
| `check-gerador-db.ts` | Verificação manual de conectividade com o banco de telemetria |
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador
git add gerador-web/README.md gerador-web/ARCHITECTURE.md gerador-web/CODEBASE.md
git commit -m "$(cat <<'EOF'
Update gerador-web docs for the telemetry integration and Docker setup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
