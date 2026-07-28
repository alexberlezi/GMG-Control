# Painel de Telemetria do Gerador (Plano C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página `/dashboard/gerador`, mostrando o status atual do gerador (cards) e um
histórico recente de RPM/temperatura/bateria (gráficos), lendo do banco de telemetria já existente.

**Architecture:** Página 100% Server Component (`src/app/dashboard/gerador/page.tsx`), sem API
routes nem Server Actions novas. Duas novas funções de leitura em `src/lib/gerador-db.ts`
(`getUltimaLeitura` já existe; `getHistoricoGerador` é nova, usando `time_bucket()` do TimescaleDB
pra agregar por média e evitar mandar milhares de pontos brutos pro navegador). Três componentes
novos em `src/components/dashboard/gerador/`: cards de status, seletor de período (navegação via
`?periodo=`) e gráfico (Recharts, Client Component). Item novo na sidebar reaproveitando a
permissão `generator:read` já existente.

**Tech Stack:** Next.js 16 (App Router, Server Components), TypeScript, `pg` (já em uso via
`src/lib/gerador-db.ts`), Recharts (nova dependência), Tailwind v4 com os tokens/classes já
existentes no projeto (`.card`, `.badge*`, `.alert*`).

## Global Constraints

- Reaproveitar a permissão `generator:read` já existente (Plano B) — nenhuma RBAC nova.
- Nenhuma API route nem Server Action nova: troca de período via `<Link href="?periodo=...">`
  (navegação normal, Server Component reexecuta). Sem polling/auto-refresh (decidido no design).
- Reaproveitar as classes CSS já existentes (`.card`, `.badge`, `.badge-success/-danger/-neutral`,
  `.alert`, `.alert-warning/-error`) em vez de criar estilos novos — ver
  `src/app/globals.css:395-472`.
- Colunas `NUMERIC` do Postgres (`bateria_v`, `rede_freq_hz`, `*_volts_*`, `*_amps_*`,
  `energia_*`) chegam do driver `pg` como **string**, não `number` — sempre `Number(...)` antes de
  `.toFixed()` ou qualquer conta. Colunas `SMALLINT`/`INTEGER` (`rpm`, `temperatura_c`,
  `combustivel_pct`, `partidas`) já chegam como `number`. Coluna `TIMESTAMPTZ` (`time`, e o
  `time_bucket()` da consulta de histórico) chega como `Date`, não `string`.
- `periodo` da URL é validado contra uma lista fixa (`'6h' | '24h' | '7d'`) antes de entrar em
  qualquer query SQL — nunca interpolado livremente.
- Nenhum framework de teste automatizado é introduzido — o projeto não tem um (ver `Testes` no
  spec); validação é manual (typecheck + build + Docker + navegador), como nos Planos A/B.
- Instalar dependência nova (`recharts`) rodando `npm install` **dentro de um container
  `node:20-alpine`**, nunca direto no host Windows — o projeto já teve problema de lockfile
  divergente entre Windows e Alpine (dependências opcionais específicas de plataforma). Ver Task 1.
- Depois de qualquer rebuild da imagem Docker (`docker compose up -d --build web`), qualquer aba do
  navegador aberta desde antes precisa de reload completo (F5) antes de testar — Server Actions
  trocam de ID a cada build. Esta feature não adiciona Server Actions novas, mas o app inteiro
  ainda é afetado por essa troca de ID em outras páginas.

---

### Task 1: Adicionar dependência Recharts

**Files:**
- Modify: `gerador-web/package.json`
- Modify: `gerador-web/package-lock.json`

**Interfaces:**
- Produces: pacote `recharts` disponível para import em Client Components.

- [ ] **Step 1: Instalar dentro de um container Alpine (evita lockfile divergente)**

Rodar a partir de `C:\Users\alexb\OneDrive\Projetos\Gerador\gerador-web`:

```bash
docker run --rm -v "$(pwd):/app" -w /app node:20-alpine npm install recharts
```

- [ ] **Step 2: Conferir que `package.json` e `package-lock.json` mudaram**

```bash
git status --short
```

Esperado: `package.json` e `package-lock.json` marcados como modificados, e `recharts` presente em
`dependencies` no `package.json`.

- [ ] **Step 3: Conferir que o typecheck no host continua limpo**

```bash
npx tsc --noEmit
```

Esperado: sem erros (o `npm install` rodou dentro do container, mas `node_modules` fica no volume
montado, então o host também enxerga o pacote instalado).

---

### Task 2: Consulta de histórico agregado (`getHistoricoGerador`)

**Files:**
- Modify: `gerador-web/src/lib/gerador-db.ts`

**Interfaces:**
- Consumes: pool `geradorDb` já existente no próprio arquivo.
- Produces:
  - `export type Periodo = '6h' | '24h' | '7d'`
  - `export const PERIODOS_VALIDOS: Periodo[]`
  - `export interface LeituraAtual { time: Date; modo_operacao: string; status_concessionaria: string; motor_status: string; rpm: number; temperatura_c: number | null; bateria_v: string; combustivel_pct: number; rede_freq_hz: string; rede_volts_l1: string; rede_volts_l2: string; rede_volts_l3: string; gerador_volts_l1: string; gerador_volts_l2: string; gerador_volts_l3: string; gerador_amps_l1: string; gerador_amps_l2: string; gerador_amps_l3: string; partidas: number; energia_kwh: string; energia_kvarh: string; energia_kvah: string; }` — tipo de retorno de `getUltimaLeitura()`
  - `export interface PontoHistorico { bucket: Date; rpm: number | null; temperatura_c: number | null; bateria_v: number | null; }` — tipo de item de `getHistoricoGerador()`
  - `export async function getHistoricoGerador(periodo: Periodo): Promise<PontoHistorico[]>`

- [ ] **Step 1: Escrever o novo conteúdo do arquivo**

Substituir `gerador-web/src/lib/gerador-db.ts` inteiro por:

```ts
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

// Colunas NUMERIC(x,y) do Postgres vêm como string do driver `pg` (evita perda de precisão
// silenciosa) — os campos abaixo tipados `string` precisam de Number(...) antes de qualquer
// conta ou .toFixed(). Campos SMALLINT/INTEGER (rpm, temperatura_c, combustivel_pct, partidas)
// já chegam como number. `time` (TIMESTAMPTZ) chega como Date.
export interface LeituraAtual {
  time: Date;
  modo_operacao: string;
  status_concessionaria: string;
  motor_status: string;
  rpm: number;
  temperatura_c: number | null;
  bateria_v: string;
  combustivel_pct: number;
  rede_freq_hz: string;
  rede_volts_l1: string;
  rede_volts_l2: string;
  rede_volts_l3: string;
  gerador_volts_l1: string;
  gerador_volts_l2: string;
  gerador_volts_l3: string;
  gerador_amps_l1: string;
  gerador_amps_l2: string;
  gerador_amps_l3: string;
  partidas: number;
  energia_kwh: string;
  energia_kvarh: string;
  energia_kvah: string;
}

export async function getUltimaLeitura(): Promise<LeituraAtual | null> {
  const { rows } = await geradorDb.query(
    `SELECT time, modo_operacao, status_concessionaria, motor_status, rpm, temperatura_c,
            bateria_v, combustivel_pct, rede_freq_hz, rede_volts_l1, rede_volts_l2, rede_volts_l3,
            gerador_volts_l1, gerador_volts_l2, gerador_volts_l3, gerador_amps_l1,
            gerador_amps_l2, gerador_amps_l3, partidas, energia_kwh, energia_kvarh, energia_kvah
     FROM leituras ORDER BY time DESC LIMIT 1`
  );
  return rows[0] ?? null;
}

// Largura do bucket por período — fixa, nunca calculada a partir de input do usuário. Mantém a
// quantidade de pontos do gráfico razoável (centenas, não milhares) em qualquer período.
const PERIODOS = {
  '6h': { bucket: '1 minute', janela: '6 hours' },
  '24h': { bucket: '5 minutes', janela: '24 hours' },
  '7d': { bucket: '1 hour', janela: '7 days' },
} as const;

export type Periodo = keyof typeof PERIODOS;

export const PERIODOS_VALIDOS = Object.keys(PERIODOS) as Periodo[];

export interface PontoHistorico {
  bucket: Date;
  rpm: number | null;
  temperatura_c: number | null;
  bateria_v: number | null;
}

export async function getHistoricoGerador(periodo: Periodo): Promise<PontoHistorico[]> {
  const { bucket, janela } = PERIODOS[periodo];
  const { rows } = await geradorDb.query(
    `SELECT time_bucket($1::interval, time) AS bucket,
            avg(rpm)::float8 AS rpm,
            avg(temperatura_c)::float8 AS temperatura_c,
            avg(bateria_v)::float8 AS bateria_v
     FROM leituras
     WHERE time > now() - $2::interval
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [bucket, janela]
  );
  return rows;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Validar a query manualmente contra o banco real, via Node (sem depender de `psql` instalado no host)**

O `GERADOR_DB_*` do `.env` local já aponta para o banco de telemetria de produção
(`10.40.3.15:5433`, somente leitura). Rodar a partir de
`C:\Users\alexb\OneDrive\Projetos\Gerador\gerador-web`, usando o `pg` que já é dependência do
projeto:

```bash
cd "C:\Users\alexb\OneDrive\Projetos\Gerador\gerador-web"
node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.GERADOR_DB_HOST,
  port: Number(process.env.GERADOR_DB_PORT || 5432),
  database: process.env.GERADOR_DB_NAME,
  user: process.env.GERADOR_DB_USER,
  password: process.env.GERADOR_DB_PASSWORD,
});
pool.query(
  \"SELECT time_bucket('5 minutes'::interval, time) AS bucket, avg(rpm)::float8 AS rpm FROM leituras WHERE time > now() - '24 hours'::interval GROUP BY bucket ORDER BY bucket ASC LIMIT 5\"
).then(r => { console.log(r.rows); return pool.end(); }).catch(e => { console.error(e); process.exit(1); });
"
```

Esperado: até 5 linhas com `bucket`/`rpm` preenchidos no console (ou array vazio se não houver
leituras nas últimas 24h — também é um resultado válido, não um erro). Um erro de conexão ou de
sintaxe SQL aqui deve ser investigado antes de seguir pra Task 3.

---

### Task 3: Cards de status atual

**Files:**
- Create: `gerador-web/src/components/dashboard/gerador/gerador-status-cards.tsx`

**Interfaces:**
- Consumes: `LeituraAtual` de `@/lib/gerador-db` (Task 2).
- Produces: `export function GeradorStatusCards({ leitura }: { leitura: LeituraAtual }): JSX.Element`

- [ ] **Step 1: Criar o arquivo**

```tsx
import type { LeituraAtual } from '@/lib/gerador-db';
import { Fuel, Gauge as GaugeIcon, Zap, RotateCw } from 'lucide-react';

interface GeradorStatusCardsProps {
  leitura: LeituraAtual;
}

function fmt(value: string | number, casas = 1): string {
  return Number(value).toFixed(casas);
}

const MODO_BADGE: Record<string, string> = {
  'Automático': 'badge-success',
  'Manual': 'badge-primary',
  'Teste': 'badge-warning',
  'Parado (Stop)': 'badge-neutral',
};

export function GeradorStatusCards({ leitura }: GeradorStatusCardsProps) {
  const redeOk = leitura.status_concessionaria === 'Rede OK';
  const motorRodando = leitura.motor_status === 'Rodando';

  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-wrap items-center gap-3">
        <span className={`badge ${MODO_BADGE[leitura.modo_operacao] || 'badge-neutral'}`}>
          Modo: {leitura.modo_operacao}
        </span>
        <span className={`badge ${redeOk ? 'badge-success' : 'badge-danger'}`}>
          {leitura.status_concessionaria}
        </span>
        <span className={`badge ${motorRodando ? 'badge-success' : 'badge-neutral'}`}>
          Motor: {leitura.motor_status}
        </span>
        <span className="text-xs text-on-surface-variant ml-auto">
          Última leitura: {leitura.time.toLocaleString('pt-BR')}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">RPM</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{leitura.rpm}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container text-primary">
              <RotateCw size={22} />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Temperatura</p>
              <p className="text-3xl font-bold text-on-surface mt-1">
                {leitura.temperatura_c !== null ? `${leitura.temperatura_c}°C` : '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container text-warning">
              <GaugeIcon size={22} />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Bateria</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{fmt(leitura.bateria_v)}V</p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container text-secondary">
              <Zap size={22} />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Combustível</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{leitura.combustivel_pct}%</p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container text-tertiary">
              <Fuel size={22} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Rede (Concessionária)</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-on-surface-variant">L1</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.rede_volts_l1)}V</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">L2</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.rede_volts_l2)}V</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">L3</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.rede_volts_l3)}V</p>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant text-center mt-3">
            Frequência: {fmt(leitura.rede_freq_hz, 2)} Hz
          </p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Gerador</h3>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div>
              <p className="text-xs text-on-surface-variant">L1</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.gerador_volts_l1)}V</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">L2</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.gerador_volts_l2)}V</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">L3</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.gerador_volts_l3)}V</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-on-surface-variant">I L1</p>
              <p className="text-sm font-medium text-on-surface">{fmt(leitura.gerador_amps_l1)}A</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">I L2</p>
              <p className="text-sm font-medium text-on-surface">{fmt(leitura.gerador_amps_l2)}A</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">I L3</p>
              <p className="text-sm font-medium text-on-surface">{fmt(leitura.gerador_amps_l3)}A</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-on-surface mb-3">Energia Acumulada</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-on-surface-variant">Ativa</p>
            <p className="text-lg font-semibold text-on-surface">{fmt(leitura.energia_kwh)} kWh</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Reativa</p>
            <p className="text-lg font-semibold text-on-surface">{fmt(leitura.energia_kvarh)} kVArh</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Aparente</p>
            <p className="text-lg font-semibold text-on-surface">{fmt(leitura.energia_kvah)} kVAh</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Partidas</p>
            <p className="text-lg font-semibold text-on-surface">{leitura.partidas}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

### Task 4: Seletor de período

**Files:**
- Create: `gerador-web/src/components/dashboard/gerador/periodo-selector.tsx`

**Interfaces:**
- Consumes: `Periodo` de `@/lib/gerador-db` (Task 2).
- Produces: `export function PeriodoSelector({ periodoAtual }: { periodoAtual: Periodo }): JSX.Element`

- [ ] **Step 1: Criar o arquivo**

```tsx
import Link from 'next/link';
import type { Periodo } from '@/lib/gerador-db';

const OPCOES: { value: Periodo; label: string }[] = [
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 dias' },
];

interface PeriodoSelectorProps {
  periodoAtual: Periodo;
}

export function PeriodoSelector({ periodoAtual }: PeriodoSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-outline-variant/30 overflow-hidden">
      {OPCOES.map((opcao) => (
        <Link
          key={opcao.value}
          href={`/dashboard/gerador?periodo=${opcao.value}`}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            opcao.value === periodoAtual
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          {opcao.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

### Task 5: Gráfico de histórico

**Files:**
- Create: `gerador-web/src/components/dashboard/gerador/gerador-history-chart.tsx`

**Interfaces:**
- Consumes: `PontoHistorico[]` de `@/lib/gerador-db` (Task 2); `recharts` (Task 1).
- Produces: `export function GeradorHistoryChart({ dados }: { dados: PontoHistorico[] }): JSX.Element`

- [ ] **Step 1: Criar o arquivo**

```tsx
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { PontoHistorico } from '@/lib/gerador-db';

interface GeradorHistoryChartProps {
  dados: PontoHistorico[];
}

function formatarHora(data: Date): string {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SERIES = [
  { key: 'rpm' as const, label: 'RPM', color: 'var(--color-primary)' },
  { key: 'temperatura_c' as const, label: 'Temperatura (°C)', color: 'var(--color-warning)' },
  { key: 'bateria_v' as const, label: 'Bateria (V)', color: 'var(--color-secondary)' },
];

export function GeradorHistoryChart({ dados }: GeradorHistoryChartProps) {
  if (dados.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant text-center py-12">
        Sem dados no período selecionado.
      </p>
    );
  }

  const dadosFormatados = dados.map((ponto) => ({
    ...ponto,
    horario: formatarHora(ponto.bucket),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {SERIES.map((serie) => (
        <div key={serie.key}>
          <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium mb-2">
            {serie.label}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dadosFormatados}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
              <XAxis dataKey="horario" tick={{ fontSize: 10 }} minTickGap={30} />
              <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip />
              <Line type="monotone" dataKey={serie.key} stroke={serie.color} dot={false} strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

### Task 6: Página `/dashboard/gerador`

**Files:**
- Create: `gerador-web/src/app/dashboard/gerador/page.tsx`

**Interfaces:**
- Consumes: `validateSession` (`@/lib/auth/session`), `can` (`@/lib/permissions`),
  `getUltimaLeitura`/`getHistoricoGerador`/`PERIODOS_VALIDOS`/`Periodo` (`@/lib/gerador-db`, Task
  2), `GeradorStatusCards` (Task 3), `PeriodoSelector` (Task 4), `GeradorHistoryChart` (Task 5).
- Produces: rota `/dashboard/gerador`.

- [ ] **Step 1: Criar o arquivo**

```tsx
import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import {
  getUltimaLeitura,
  getHistoricoGerador,
  PERIODOS_VALIDOS,
  type Periodo,
} from '@/lib/gerador-db';
import { GeradorStatusCards } from '@/components/dashboard/gerador/gerador-status-cards';
import { GeradorHistoryChart } from '@/components/dashboard/gerador/gerador-history-chart';
import { PeriodoSelector } from '@/components/dashboard/gerador/periodo-selector';
import { AlertTriangle, ServerCrash } from 'lucide-react';

const PERIODO_PADRAO: Periodo = '24h';

function isPeriodo(value: string | undefined): value is Periodo {
  return !!value && (PERIODOS_VALIDOS as string[]).includes(value);
}

export default async function GeradorPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'generator', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }

  const { periodo: periodoParam } = await searchParams;
  const periodo: Periodo = isPeriodo(periodoParam) ? periodoParam : PERIODO_PADRAO;

  let leitura;
  let historico;
  try {
    [leitura, historico] = await Promise.all([
      getUltimaLeitura(),
      getHistoricoGerador(periodo),
    ]);
  } catch (error) {
    console.error('[GeradorPage] Falha ao consultar banco de telemetria:', error);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Painel do Gerador</h1>
        </div>
        <div className="alert alert-error">
          <ServerCrash size={20} className="shrink-0" />
          <div>
            <p className="font-medium">Não foi possível conectar ao banco de telemetria.</p>
            <p className="text-sm opacity-80 mt-1">
              Verifique se o serviço de coleta e o banco de dados do gerador estão acessíveis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dadoObsoleto = !leitura || (Date.now() - leitura.time.getTime()) > 2 * 60 * 1000;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Painel do Gerador</h1>
        <p className="text-sm text-on-surface-variant">
          Status e histórico recente do gerador Deep Sea 4520 MKII.
        </p>
      </div>

      {dadoObsoleto && (
        <div className="alert alert-warning">
          <AlertTriangle size={20} className="shrink-0" />
          <p>
            {leitura
              ? `Sem dados recentes do gerador — última leitura em ${leitura.time.toLocaleString('pt-BR')}.`
              : 'Nenhuma leitura encontrada no banco de telemetria.'}{' '}
            Verifique a coleta.
          </p>
        </div>
      )}

      {leitura && <GeradorStatusCards leitura={leitura} />}

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-on-surface">Histórico</h2>
          <PeriodoSelector periodoAtual={periodo} />
        </div>
        <GeradorHistoryChart dados={historico} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Build de produção local (sem Docker) só pra pegar erros de RSC/serialização cedo**

```bash
npx next build
```

Esperado: build conclui sem erros, `/dashboard/gerador` aparece na lista de rotas como `ƒ`
(dinâmica — herda `force-dynamic` do layout raiz).

---

### Task 7: Item de navegação na sidebar

**Files:**
- Modify: `gerador-web/src/components/dashboard/dashboard-shell.tsx`

**Interfaces:**
- Consumes: nenhuma nova (usa o mesmo padrão `Can`/`resource: 'generator'` já usado por
  Manutenções).

- [ ] **Step 1: Adicionar `Zap` à importação de ícones do `lucide-react`**

Em `dashboard-shell.tsx:6-10`, mudar:

```ts
import {
  LayoutDashboard, Users, ShieldCheck, Mail as MailIcon, Activity,
  Settings, UserCircle, Bell, Menu, X, LogOut, Moon, Sun,
  Key, Globe, Lock, ChevronDown, Gauge, Layers, SlidersHorizontal, Home, Wrench
} from 'lucide-react';
```

para:

```ts
import {
  LayoutDashboard, Users, ShieldCheck, Mail as MailIcon, Activity,
  Settings, UserCircle, Bell, Menu, X, LogOut, Moon, Sun,
  Key, Globe, Lock, ChevronDown, Gauge, Layers, SlidersHorizontal, Home, Wrench, Zap
} from 'lucide-react';
```

- [ ] **Step 2: Adicionar o item de navegação na seção GERADOR**

Em `dashboard-shell.tsx:42-44`, mudar:

```ts
  { label: 'GERADOR', icon: Gauge, items: [
    { href: '/dashboard/manutencao', icon: Wrench, label: 'Manutenções', resource: 'generator' },
  ]},
```

para:

```ts
  { label: 'GERADOR', icon: Gauge, items: [
    { href: '/dashboard/gerador', icon: Zap, label: 'Painel do Gerador', resource: 'generator' },
    { href: '/dashboard/manutencao', icon: Wrench, label: 'Manutenções', resource: 'generator' },
  ]},
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

---

### Task 8: Validação manual end-to-end

**Files:** nenhum (só validação).

- [ ] **Step 1: Rebuild e restart do container**

```bash
cd "C:\Users\alexb\OneDrive\Projetos\Gerador\gerador-web"
docker compose up -d --build web
```

- [ ] **Step 2: Conferir a rota via curl (sem sessão, deve redirecionar pro login)**

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3001/dashboard/gerador"
```

Esperado: `307`/`302` redirecionando pra `/login`.

- [ ] **Step 3: Testar no navegador logado**

Pedir para o usuário (ou usar o browser conectado, se a sessão já estiver ativa): dar F5 na aba
aberta (Server Actions do resto do app trocaram de ID no rebuild), entrar em "Painel do Gerador"
na sidebar, conferir:
- Cards de status mostram valores plausíveis (RPM, temperatura, bateria, tensões, correntes,
  energia, partidas).
- Badges de modo/rede/motor com cor condizente.
- Gráficos de RPM/temperatura/bateria aparecem preenchidos.
- Trocar entre 6h/24h/7d no seletor de período muda os gráficos.
- Se a última leitura for antiga (>2min), o aviso amarelo aparece.

- [ ] **Step 4: Conferir logs do container em busca de erro silencioso**

```bash
docker compose logs web --tail 50
```

Esperado: sem stack trace novo relacionado a `/dashboard/gerador` ou `gerador-db`.
