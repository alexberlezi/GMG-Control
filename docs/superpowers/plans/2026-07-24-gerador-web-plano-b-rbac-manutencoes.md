# Gerador Web — Plano B: RBAC do Gerador + CRUD de Manutenções Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao `gerador-web` (fundação já pronta no Plano A) as permissões RBAC específicas
do domínio do gerador e um CRUD completo de registros de manutenção (abastecimento, troca de
óleo, aditivo, bateria, limpeza, defeitos/avarias), com anexos de foto/comprovante.

**Architecture:** Segue exatamente os padrões já estabelecidos no AuthForge/gerador-web: Server
Actions envolvidas por `withPermission`/`withAuth` (`src/lib/auth/wrapper.ts`), página servidor +
componente cliente (`page.tsx` + `*-client.tsx`), upload em disco via `fs/promises` sob
`public/uploads/`, permissões `recurso:ação` verificadas pelo motor existente em
`src/lib/permissions.ts`.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7, PostgreSQL, `lucide-react` (ícones),
`sonner` (toasts) — nenhuma dependência nova.

## Global Constraints

- O motor de permissões (`src/lib/permissions.ts`) só reconhece as ações
  `'create' | 'read' | 'update' | 'delete' | 'manage' | 'invite' | '*'`. As permissões deste
  plano usam exatamente este vocabulário (mapeamento aprovado com o usuário):
  - `generator:read` — ver dashboard/relatórios do gerador **e** a lista de manutenções.
  - `maintenance:create` / `maintenance:update` / `maintenance:delete` — mutações específicas.
  - `reports:export` — exportar relatórios (ação nova `'export'`, adicionada ao union type nesta
    task; a label `'Exportar Dados'` já existe em `ACTION_LABELS` no componente de Grupos).
- `seed-permissions.js` só roda seu bloco de seed se `Permission.count() === 0` — **não** é
  reexecutável para adicionar permissões novas a um banco já inicializado. Este plano usa um
  script próprio, idempotente (`permission.upsert` + `rolePermission.upsert`), sem depender do
  guard de contagem.
- Campos monetários/numéricos (`quantidade`, `custo`) são `Decimal` no Prisma — sempre convertidos
  para `number` (via `.toNumber()`) antes de cruzar a fronteira Server Action → Client Component
  (instâncias de `Decimal` não serializam corretamente nessa fronteira).
- Tipos exportados de actions (`RegistroManutencaoWithDetails`) são declarados como literal
  TypeScript explícito (não importam o enum do Prisma diretamente), seguindo o padrão já usado em
  `InviteWithDetails` (`src/actions/invites.ts`).
- Anexos são apenas adicionados, nunca removidos nesta versão (escopo mínimo aprovado na spec) —
  excluir o registro inteiro remove os anexos em cascata (linhas do banco; os arquivos físicos em
  `public/uploads/manutencoes/` não são apagados automaticamente — limitação conhecida, não
  bloqueia esta fase).
- Nenhum novo pacote npm é necessário — tudo usa dependências já presentes (`lucide-react`,
  `sonner`, `fs/promises`).

---

### Task 1: Schema Prisma — modelos de manutenção e migração

**Files:**
- Modify: `gerador-web/prisma/schema.prisma`
- Modify: `gerador-web/docker-compose.yml` (expõe a porta do `postgres-web` para rodar
  `prisma migrate dev` a partir do host)
- Create: `gerador-web/prisma/migrations/<timestamp>_add_maintenance_records/` (gerada pelo
  Prisma, não escrita à mão)

**Interfaces:**
- Produces: modelos `RegistroManutencao`, `AnexoManutencao`, enum `TipoManutencao` no Prisma
  Client gerado (`@prisma/client`), consumidos pela Task 3 (`src/actions/manutencao.ts`).

- [ ] **Step 1: Adicionar o enum e os modelos ao schema**

Editar `gerador-web/prisma/schema.prisma`. Adicionar o enum e os dois modelos novos logo após o
fechamento do modelo `RateLimit` (final do arquivo), e adicionar uma linha de relação recíproca
no modelo `User`:

```prisma
enum TipoManutencao {
  ABASTECIMENTO
  TROCA_OLEO
  ADITIVO
  BATERIA
  LIMPEZA
  DEFEITO_AVARIA
  OUTRO
}

model RegistroManutencao {
  id            String         @id @default(cuid())
  tipo          TipoManutencao
  dataHora      DateTime
  responsavelId String?
  quantidade    Decimal?
  unidadeMedida String?
  custo         Decimal?
  observacoes   String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  responsavel User?             @relation(fields: [responsavelId], references: [id], onDelete: SetNull)
  anexos      AnexoManutencao[]

  @@index([dataHora])
  @@index([tipo])
}

model AnexoManutencao {
  id                   String   @id @default(cuid())
  registroManutencaoId String
  caminhoArquivo       String
  createdAt            DateTime @default(now())

  registroManutencao RegistroManutencao @relation(fields: [registroManutencaoId], references: [id], onDelete: Cascade)

  @@index([registroManutencaoId])
}
```

No modelo `User` (por volta da linha 52), adicionar a relação recíproca logo após a linha
`invitesSent Invite[] @relation("InvitesSent")`:

```prisma
  manutencoesRegistradas RegistroManutencao[]
```

- [ ] **Step 2: Expor a porta do `postgres-web` no docker-compose para rodar a migration a partir do host**

Em `gerador-web/docker-compose.yml`, adicionar um bloco `ports` ao serviço `postgres-web` (ele
não tinha nenhum até agora — só o `web` era exposto):

```yaml
  postgres-web:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5434:5432"
    volumes:
      - postgres_web_data:/var/lib/postgresql/data
```

(Só a seção `ports` é nova — o resto do serviço permanece igual ao que já existe.)

- [ ] **Step 3: Subir o banco e rodar a migration**

```bash
cd gerador-web
docker compose up -d postgres-web
sleep 5
```

Confirmar as credenciais reais do `.env` local (criado no Plano A — `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB`):

```bash
cat .env | grep POSTGRES
```

Rodar a migration a partir do host, sobrescrevendo `DATABASE_URL` só para este comando (o `.env`
continua apontando para `postgres-web:5432`, o hostname interno do Docker, que só funciona de
dentro do container `web` — este override usa `localhost:5434`, a porta exposta no Step 2):

```bash
DATABASE_URL="postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:5434/<POSTGRES_DB>" npx prisma migrate dev --name add_maintenance_records
```

(Substituir `<POSTGRES_USER>`, `<POSTGRES_PASSWORD>`, `<POSTGRES_DB>` pelos valores reais do
`.env` local.)

Expected: Prisma detecta a diferença de schema, gera uma nova pasta em
`prisma/migrations/<timestamp>_add_maintenance_records/migration.sql`, aplica no banco, e
regenera o `@prisma/client` (`npx prisma generate` roda automaticamente como parte do
`migrate dev`).

- [ ] **Step 4: Confirmar que o client gerado expõe os novos modelos**

```bash
grep -n "RegistroManutencao\|AnexoManutencao\|TipoManutencao" node_modules/.prisma/client/index.d.ts | head -5
```

Expected: aparecem referências aos três nomes novos no client TypeScript gerado.

- [ ] **Step 5: Parar o banco (não deixar rodando sem necessidade)**

```bash
docker compose down
```

(Sem `-v` — preserva o volume, agora já com a migration aplicada.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations docker-compose.yml
git commit -m "$(cat <<'EOF'
Add RegistroManutencao/AnexoManutencao models and migration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Motor de permissões — ação "export" e permissões do gerador

**Files:**
- Modify: `gerador-web/src/lib/permissions.ts`
- Create: `gerador-web/seed-generator-permissions.js`
- Modify: `gerador-web/src/components/dashboard/roles/roles-client.tsx`

**Interfaces:**
- Consumes: nenhuma nova (usa `db` de `@/lib/db`, já existente).
- Produces: permissões `generator:read`, `maintenance:create`, `maintenance:update`,
  `maintenance:delete`, `reports:export` disponíveis no banco e atribuídas ao papel Owner,
  prontas para a Task 3 usar em `withPermission(...)`.

- [ ] **Step 1: Adicionar `'export'` ao union type de ações**

Em `gerador-web/src/lib/permissions.ts`, localizar a linha:

```typescript
type Action = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'invite' | '*';
```

Substituir por:

```typescript
type Action = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'invite' | 'export' | '*';
```

Não alterar `MANAGE_INCLUDES` — `'export'` fica fora dela de propósito (mesmo tratamento que
`'invite'` já recebe), então `resource:manage` sozinho não concede `export`; só concede quem tiver
`reports:export`, `reports:*`, ou `*:manage` (Owner/superadmin).

- [ ] **Step 2: Criar o script de seed idempotente**

```javascript
// gerador-web/seed-generator-permissions.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NOVAS_PERMISSOES = [
  { resource: 'generator', action: 'read', description: 'Visualizar dashboard, manutenções e relatórios do gerador' },
  { resource: 'maintenance', action: 'create', description: 'Registrar nova manutenção do gerador' },
  { resource: 'maintenance', action: 'update', description: 'Editar registro de manutenção do gerador' },
  { resource: 'maintenance', action: 'delete', description: 'Excluir registro de manutenção do gerador' },
  { resource: 'reports', action: 'export', description: 'Exportar relatórios do gerador em PDF/Excel' },
];

async function main() {
  for (const perm of NOVAS_PERMISSOES) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      update: {},
      create: perm,
    });
  }
  console.log('Permissões do gerador seedadas/confirmadas.');

  let ownerRole = await prisma.role.findUnique({ where: { name: 'Owner' } });
  if (!ownerRole) {
    ownerRole = await prisma.role.create({
      data: { name: 'Owner', description: 'Acesso total ao sistema', isSystem: true }
    });
    console.log('Created Owner role.');
  }

  const perms = await prisma.permission.findMany({
    where: { resource: { in: ['generator', 'maintenance', 'reports'] } }
  });
  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: ownerRole.id, permissionId: p.id }
    });
  }
  console.log('Permissões do gerador atribuídas ao Owner.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Salvar em `gerador-web/seed-generator-permissions.js` (raiz do projeto, ao lado do
`seed-permissions.js` original, mesmo padrão).

- [ ] **Step 3: Rodar o seed contra o banco local**

```bash
cd gerador-web
docker compose up -d postgres-web
sleep 5
DATABASE_URL="postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:5434/<POSTGRES_DB>" node seed-generator-permissions.js
```

Expected: imprime as 4 linhas de log confirmando seed + atribuição ao Owner, sem erro.

Rodar de novo (mesma linha de comando) para confirmar idempotência:

Expected: roda sem erro novamente, sem duplicar nada (upsert não recria o que já existe).

```bash
docker compose down
```

- [ ] **Step 4: Adicionar os labels das novas permissões na UI de Grupos**

Em `gerador-web/src/components/dashboard/roles/roles-client.tsx`, localizar o objeto
`RESOURCE_LABELS`:

```typescript
const RESOURCE_LABELS: Record<string, string> = {
  '*': 'Acesso Global (Todos os Módulos)',
  'audit_logs': 'Auditoria (Logs)',
  'invites': 'Convites',
  'roles': 'Grupos e Permissões',
  'sessions': 'Sessões Ativas',
  'settings': 'Configurações Globais',
  'users': 'Gestão de Usuários',
};
```

Substituir por (adiciona 3 entradas, mantém as existentes):

```typescript
const RESOURCE_LABELS: Record<string, string> = {
  '*': 'Acesso Global (Todos os Módulos)',
  'audit_logs': 'Auditoria (Logs)',
  'generator': 'Gerador — Dashboard e Manutenções',
  'invites': 'Convites',
  'maintenance': 'Manutenções do Gerador',
  'reports': 'Relatórios do Gerador',
  'roles': 'Grupos e Permissões',
  'sessions': 'Sessões Ativas',
  'settings': 'Configurações Globais',
  'users': 'Gestão de Usuários',
};
```

(`ACTION_LABELS` já contém `'export': 'Exportar Dados'` — não precisa de alteração.)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador/gerador-web
git add src/lib/permissions.ts seed-generator-permissions.js src/components/dashboard/roles/roles-client.tsx
git commit -m "$(cat <<'EOF'
Add generator RBAC permissions (generator:read, maintenance:*, reports:export)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Server Actions de manutenção (CRUD + upload de anexos)

**Files:**
- Create: `gerador-web/src/actions/manutencao.ts`
- Modify: `gerador-web/src/lib/audit.ts` (novas entradas em `AuditAction`)

**Interfaces:**
- Consumes: `withPermission`/`withAuth` (`@/lib/auth/wrapper`), `db` (`@/lib/db`), `logAudit`
  (`@/lib/audit`), `getClientIp` (`@/lib/network`), `detectImageType` (`@/lib/upload`).
- Produces (consumido pela Task 4):
  - `export type RegistroManutencaoWithDetails` — forma de um registro com `responsavel` e
    `anexos` incluídos, `quantidade`/`custo` já convertidos para `number | null`.
  - `getManutencoes(): Promise<RegistroManutencaoWithDetails[] | ActionError>`
  - `createManutencao(data): Promise<{ success: true; registro: RegistroManutencaoWithDetails } | ActionError>`
  - `updateManutencao(id, data): Promise<{ success: true; registro: RegistroManutencaoWithDetails } | ActionError>`
  - `deleteManutencao(id): Promise<{ success: true } | ActionError>`
  - `uploadAnexoManutencao(formData): Promise<{ success: true; url: string } | ActionError>`

- [ ] **Step 1: Adicionar as novas ações de auditoria**

Em `gerador-web/src/lib/audit.ts`, dentro do objeto `AuditAction`, adicionar uma nova seção logo
após o bloco `// Invites` (antes de `// Settings`):

```typescript
  // Maintenance
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_UPDATE: 'maintenance.update',
  MAINTENANCE_DELETE: 'maintenance.delete',
```

- [ ] **Step 2: Criar `src/actions/manutencao.ts`**

```typescript
'use server';

import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { withPermission, withAuth } from '@/lib/auth/wrapper';
import { logAudit, AuditAction } from '@/lib/audit';
import { getClientIp } from '@/lib/network';
import { detectImageType } from '@/lib/upload';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { TipoManutencao } from '@prisma/client';

const VALID_TIPOS: TipoManutencao[] = [
  'ABASTECIMENTO', 'TROCA_OLEO', 'ADITIVO', 'BATERIA', 'LIMPEZA', 'DEFEITO_AVARIA', 'OUTRO'
];

export type RegistroManutencaoWithDetails = {
  id: string;
  tipo: 'ABASTECIMENTO' | 'TROCA_OLEO' | 'ADITIVO' | 'BATERIA' | 'LIMPEZA' | 'DEFEITO_AVARIA' | 'OUTRO';
  dataHora: Date;
  responsavelId: string | null;
  quantidade: number | null;
  unidadeMedida: string | null;
  custo: number | null;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
  responsavel: { id: string; name: string } | null;
  anexos: { id: string; caminhoArquivo: string }[];
};

type ManutencaoInput = {
  tipo: string;
  dataHora: string;
  quantidade?: number;
  unidadeMedida?: string;
  custo?: number;
  observacoes?: string;
  anexoPaths?: string[];
};

function toDetails(registro: any): RegistroManutencaoWithDetails {
  return {
    ...registro,
    quantidade: registro.quantidade ? registro.quantidade.toNumber() : null,
    custo: registro.custo ? registro.custo.toNumber() : null,
  };
}

export const getManutencoes = withPermission('generator:read', async (session) => {
  const registros = await db.registroManutencao.findMany({
    orderBy: { dataHora: 'desc' },
    include: {
      responsavel: { select: { id: true, name: true } },
      anexos: { select: { id: true, caminhoArquivo: true } },
    },
  });
  return registros.map(toDetails);
});

export const createManutencao = withPermission('maintenance:create', async (session, data: ManutencaoInput) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  if (!VALID_TIPOS.includes(data.tipo as TipoManutencao)) {
    return { success: false, error: 'Tipo de manutenção inválido.' };
  }
  if (!data.dataHora) {
    return { success: false, error: 'Data/hora é obrigatória.' };
  }

  const registro = await db.registroManutencao.create({
    data: {
      tipo: data.tipo as TipoManutencao,
      dataHora: new Date(data.dataHora),
      responsavelId: session.user.id,
      quantidade: data.quantidade ?? null,
      unidadeMedida: data.unidadeMedida?.trim() || null,
      custo: data.custo ?? null,
      observacoes: data.observacoes?.trim() || null,
      anexos: data.anexoPaths && data.anexoPaths.length > 0
        ? { create: data.anexoPaths.map(caminhoArquivo => ({ caminhoArquivo })) }
        : undefined,
    },
    include: {
      responsavel: { select: { id: true, name: true } },
      anexos: { select: { id: true, caminhoArquivo: true } },
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditAction.MAINTENANCE_CREATE,
    metadata: { registroId: registro.id, tipo: registro.tipo },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true, registro: toDetails(registro) };
});

export const updateManutencao = withPermission('maintenance:update', async (session, id: string, data: ManutencaoInput) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  if (!VALID_TIPOS.includes(data.tipo as TipoManutencao)) {
    return { success: false, error: 'Tipo de manutenção inválido.' };
  }
  if (!data.dataHora) {
    return { success: false, error: 'Data/hora é obrigatória.' };
  }

  const registro = await db.registroManutencao.update({
    where: { id },
    data: {
      tipo: data.tipo as TipoManutencao,
      dataHora: new Date(data.dataHora),
      quantidade: data.quantidade ?? null,
      unidadeMedida: data.unidadeMedida?.trim() || null,
      custo: data.custo ?? null,
      observacoes: data.observacoes?.trim() || null,
      anexos: data.anexoPaths && data.anexoPaths.length > 0
        ? { create: data.anexoPaths.map(caminhoArquivo => ({ caminhoArquivo })) }
        : undefined,
    },
    include: {
      responsavel: { select: { id: true, name: true } },
      anexos: { select: { id: true, caminhoArquivo: true } },
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditAction.MAINTENANCE_UPDATE,
    metadata: { registroId: id, tipo: registro.tipo },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true, registro: toDetails(registro) };
});

export const deleteManutencao = withPermission('maintenance:delete', async (session, id: string) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  const registro = await db.registroManutencao.findUnique({ where: { id } });
  if (!registro) {
    return { success: false, error: 'Registro não encontrado.' };
  }

  await db.registroManutencao.delete({ where: { id } });

  await logAudit({
    userId: session.user.id,
    action: AuditAction.MAINTENANCE_DELETE,
    metadata: { registroId: id, tipo: registro.tipo },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true };
});

export const uploadAnexoManutencao = withAuth(async (session, formData: FormData) => {
  const file = formData.get('file') as File;
  if (!file) {
    return { success: false, error: 'Nenhum arquivo enviado.' };
  }
  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'O arquivo deve ser uma imagem.' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'A imagem deve ter no máximo 5MB.' };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const extension = detectImageType(buffer);
  if (!extension) {
    return { success: false, error: 'Arquivo inválido ou não suportado (apenas imagens reais são permitidas, SVG desabilitado).' };
  }

  const publicDir = join(process.cwd(), 'public');
  const uploadDir = join(publicDir, 'uploads', 'manutencoes');
  await mkdir(uploadDir, { recursive: true });

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const fileName = `${session.user.id}-${timestamp}-${randomSuffix}.${extension}`;
  const filePath = join(uploadDir, fileName);
  await writeFile(filePath, buffer);

  return { success: true, url: `/uploads/manutencoes/${fileName}` };
});
```

- [ ] **Step 3: Verificação de tipos**

```bash
cd gerador-web
npx tsc --noEmit
```

Expected: nenhum erro relacionado a `src/actions/manutencao.ts` ou `src/lib/audit.ts` (pode haver
erros pré-existentes em outros arquivos não relacionados a este plano — se houver, confirme que
são os mesmos que já existiam antes desta task, não introduzidos por ela).

- [ ] **Step 4: Commit**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador/gerador-web
git add src/actions/manutencao.ts src/lib/audit.ts
git commit -m "$(cat <<'EOF'
Add maintenance CRUD server actions and attachment upload

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Página e componente de manutenções (lista, criar/editar, excluir, anexos)

**Files:**
- Create: `gerador-web/src/app/dashboard/manutencao/page.tsx`
- Create: `gerador-web/src/components/dashboard/manutencao/manutencao-client.tsx`

**Interfaces:**
- Consumes: `getManutencoes`, `createManutencao`, `updateManutencao`, `deleteManutencao`,
  `uploadAnexoManutencao`, `type RegistroManutencaoWithDetails` (todos de `@/actions/manutencao`,
  Task 3); `validateSession` (`@/lib/auth/session`); `can` (`@/lib/permissions`); `usePermissions`
  (`@/hooks/use-permissions`).
- Produces: rota `/dashboard/manutencao`, navegável (a Task 5 adiciona o link no menu).

- [ ] **Step 1: Criar a página servidor**

```tsx
// gerador-web/src/app/dashboard/manutencao/page.tsx
import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { getManutencoes } from '@/actions/manutencao';
import { ManutencaoClient } from '@/components/dashboard/manutencao/manutencao-client';

export default async function ManutencaoPage() {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'generator', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }

  const registros = await getManutencoes();

  if (!Array.isArray(registros)) {
    redirect('/dashboard?error=access_denied');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Manutenções do Gerador</h1>
        <p className="text-sm text-on-surface-variant">
          Abastecimento, troca de óleo, aditivo, bateria, limpeza e registro de defeitos/avarias.
        </p>
      </div>
      <ManutencaoClient initialRegistros={registros} />
    </div>
  );
}
```

- [ ] **Step 2: Criar o componente cliente**

```tsx
// gerador-web/src/components/dashboard/manutencao/manutencao-client.tsx
'use client';

import { useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, Loader2, Check, Search, Paperclip, Camera } from 'lucide-react';
import {
  createManutencao,
  updateManutencao,
  deleteManutencao,
  uploadAnexoManutencao,
  type RegistroManutencaoWithDetails,
} from '@/actions/manutencao';
import { usePermissions } from '@/hooks/use-permissions';

const TIPO_LABELS: Record<string, string> = {
  ABASTECIMENTO: 'Abastecimento',
  TROCA_OLEO: 'Troca de Óleo',
  ADITIVO: 'Aditivo',
  BATERIA: 'Bateria',
  LIMPEZA: 'Limpeza',
  DEFEITO_AVARIA: 'Defeito / Avaria',
  OUTRO: 'Outro',
};

const TIPOS = Object.keys(TIPO_LABELS) as (keyof typeof TIPO_LABELS)[];

function formatDataHora(d: Date | string) {
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function ManutencaoClient({ initialRegistros }: { initialRegistros: RegistroManutencaoWithDetails[] }) {
  const { can } = usePermissions();
  const [registros, setRegistros] = useState(initialRegistros);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<RegistroManutencaoWithDetails | null>(null);
  const [deletingRegistro, setDeletingRegistro] = useState<RegistroManutencaoWithDetails | null>(null);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');

  const filtered = useMemo(() => {
    let list = [...registros];
    if (filterTipo !== 'TODOS') {
      list = list.filter(r => r.tipo === filterTipo);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.observacoes || '').toLowerCase().includes(q) ||
        (r.responsavel?.name || '').toLowerCase().includes(q) ||
        TIPO_LABELS[r.tipo].toLowerCase().includes(q)
      );
    }
    return list;
  }, [registros, search, filterTipo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="input input-icon-left"
              placeholder="Buscar por observação, responsável, tipo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input max-w-[200px]" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="TODOS">Todos os tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
          </select>
        </div>
        {can('maintenance', 'create') && (
          <button onClick={() => setShowCreate(true)} className="btn btn-primary gap-1.5 shrink-0">
            <Plus size={16} /> Nova Manutenção
          </button>
        )}
      </div>

      <div className="card border border-outline-variant/30 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-container/60 text-xs uppercase tracking-wider text-on-surface-variant">
            <tr>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-left px-4 py-3">Data/Hora</th>
              <th className="text-left px-4 py-3">Responsável</th>
              <th className="text-left px-4 py-3">Quantidade</th>
              <th className="text-left px-4 py-3">Custo</th>
              <th className="text-left px-4 py-3">Anexos</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">Nenhum registro encontrado.</td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-outline-variant/10">
                <td className="px-4 py-3 font-medium text-on-surface">{TIPO_LABELS[r.tipo]}</td>
                <td className="px-4 py-3 text-on-surface-variant">{formatDataHora(r.dataHora)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{r.responsavel?.name || '—'}</td>
                <td className="px-4 py-3 text-on-surface-variant">{r.quantidade != null ? `${r.quantidade} ${r.unidadeMedida || ''}` : '—'}</td>
                <td className="px-4 py-3 text-on-surface-variant">{r.custo != null ? `R$ ${r.custo.toFixed(2)}` : '—'}</td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {r.anexos.length > 0 ? (
                    <span className="inline-flex items-center gap-1"><Paperclip size={14} /> {r.anexos.length}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {can('maintenance', 'update') && (
                      <button onClick={() => setEditingRegistro(r)} className="btn-icon"><Edit2 size={16} /></button>
                    )}
                    {can('maintenance', 'delete') && (
                      <button onClick={() => setDeletingRegistro(r)} className="btn-icon-danger"><Trash2 size={16} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showCreate || editingRegistro) && (
        <ManutencaoModal
          registro={editingRegistro}
          onClose={() => { setShowCreate(false); setEditingRegistro(null); }}
          onSaved={(registro) => {
            if (editingRegistro) {
              setRegistros(prev => prev.map(r => r.id === registro.id ? registro : r));
            } else {
              setRegistros(prev => [registro, ...prev]);
            }
            setShowCreate(false);
            setEditingRegistro(null);
          }}
        />
      )}

      {deletingRegistro && (
        <DeleteManutencaoModal
          registro={deletingRegistro}
          onClose={() => setDeletingRegistro(null)}
          onSuccess={() => {
            setRegistros(prev => prev.filter(r => r.id !== deletingRegistro.id));
            setDeletingRegistro(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Create/Edit Modal ──────────────────────────────────
function ManutencaoModal({
  registro,
  onClose,
  onSaved,
}: {
  registro: RegistroManutencaoWithDetails | null;
  onClose: () => void;
  onSaved: (registro: RegistroManutencaoWithDetails) => void;
}) {
  const isEditing = !!registro;
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toLocalInputValue(d: Date | string) {
    const date = new Date(d);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  const [form, setForm] = useState({
    tipo: registro?.tipo || 'ABASTECIMENTO',
    dataHora: registro ? toLocalInputValue(registro.dataHora) : toLocalInputValue(new Date()),
    quantidade: registro?.quantidade?.toString() || '',
    unidadeMedida: registro?.unidadeMedida || '',
    custo: registro?.custo?.toString() || '',
    observacoes: registro?.observacoes || '',
  });
  const [newAnexoPaths, setNewAnexoPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadAnexoManutencao(formData);
      if (res.success && res.url) {
        setNewAnexoPaths(prev => [...prev, res.url]);
      } else {
        toast.error(res.error || 'Falha ao enviar anexo.');
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      tipo: form.tipo,
      dataHora: new Date(form.dataHora).toISOString(),
      quantidade: form.quantidade ? Number(form.quantidade) : undefined,
      unidadeMedida: form.unidadeMedida || undefined,
      custo: form.custo ? Number(form.custo) : undefined,
      observacoes: form.observacoes || undefined,
      anexoPaths: newAnexoPaths,
    };

    const result = isEditing
      ? await updateManutencao(registro!.id, payload)
      : await createManutencao(payload);

    if (result.success) {
      toast.success(isEditing ? 'Manutenção atualizada!' : 'Manutenção registrada!');
      onSaved(result.registro);
    } else {
      setError(result.error || 'Erro ao salvar manutenção');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 shrink-0">
          <h2 className="text-lg font-bold text-on-surface">{isEditing ? 'Editar Manutenção' : 'Nova Manutenção'}</h2>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>
          )}

          <div>
            <label className="label">Tipo *</label>
            <select className="input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} required>
              {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Data/Hora *</label>
            <input type="datetime-local" className="input" value={form.dataHora} onChange={e => setForm(p => ({ ...p, dataHora: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantidade</label>
              <input className="input" type="number" step="0.01" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} placeholder="Ex: 20" />
            </div>
            <div>
              <label className="label">Unidade</label>
              <input className="input" value={form.unidadeMedida} onChange={e => setForm(p => ({ ...p, unidadeMedida: e.target.value }))} placeholder="Ex: L" />
            </div>
          </div>

          <div>
            <label className="label">Custo (R$)</label>
            <input className="input" type="number" step="0.01" value={form.custo} onChange={e => setForm(p => ({ ...p, custo: e.target.value }))} placeholder="Ex: 150.00" />
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea className="input min-h-[80px] resize-none" value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Detalhes, defeito encontrado, etc." />
          </div>

          <div>
            <label className="label">Anexos (fotos/comprovantes)</label>
            {isEditing && registro!.anexos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {registro!.anexos.map(a => (
                  <img key={a.id} src={a.caminhoArquivo} alt="Anexo" className="w-full h-16 object-cover rounded-lg border border-outline-variant/20" />
                ))}
              </div>
            )}
            {newAnexoPaths.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {newAnexoPaths.map((url, i) => (
                  <img key={i} src={url} alt="Novo anexo" className="w-full h-16 object-cover rounded-lg border border-primary/40" />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn btn-secondary btn-sm gap-1.5"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              Adicionar foto
            </button>
            <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleFilesChange} />
          </div>
        </form>

        <div className="p-4 border-t border-outline-variant/10 flex gap-3 shrink-0 bg-surface-container">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={loading || uploading} className="btn btn-primary flex-1 gap-1.5">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ──────────────────────────────────
function DeleteManutencaoModal({
  registro,
  onClose,
  onSuccess,
}: {
  registro: RegistroManutencaoWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');
    const result = await deleteManutencao(registro.id);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Erro ao excluir manutenção');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-bold text-on-surface mb-2">Excluir Manutenção</h2>
        <p className="text-sm text-on-surface-variant mb-6">
          Tem certeza que deseja excluir este registro de <strong className="text-on-surface">{TIPO_LABELS[registro.tipo]}</strong>? Esta ação não pode ser desfeita.
        </p>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
          <button type="button" onClick={handleDelete} disabled={loading} className="btn flex-1 bg-red-500 hover:bg-red-600 text-white gap-1.5">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificação de tipos**

```bash
cd gerador-web
npx tsc --noEmit
```

Expected: nenhum erro novo introduzido pelos dois arquivos desta task.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador/gerador-web
git add src/app/dashboard/manutencao/page.tsx src/components/dashboard/manutencao/manutencao-client.tsx
git commit -m "$(cat <<'EOF'
Add maintenance dashboard page (list, create/edit, delete, attachments)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Navegação e validação end-to-end

**Files:**
- Modify: `gerador-web/src/components/dashboard/dashboard-shell.tsx`
- Modify: `gerador-web/README.md`, `gerador-web/CODEBASE.md`

**Interfaces:** Nenhuma nova — conecta a rota criada na Task 4 ao menu, e valida o fluxo completo.

- [ ] **Step 1: Adicionar o item de menu**

Em `gerador-web/src/components/dashboard/dashboard-shell.tsx`, adicionar `Wrench` à lista de
ícones importados de `lucide-react` (linha 6-10):

```typescript
import {
  LayoutDashboard, Users, ShieldCheck, Mail as MailIcon, Activity,
  Settings, UserCircle, Bell, Menu, X, LogOut, Moon, Sun,
  Key, Globe, Lock, ChevronDown, Gauge, Layers, SlidersHorizontal, Home, Wrench
} from 'lucide-react';
```

Adicionar uma nova seção `SECTION_ITEMS`, logo antes da seção `'CONFIGURAÇÕES'`:

```typescript
const SECTION_ITEMS = [
  { label: 'GERENCIAMENTO', icon: Layers, items: [
    { href: '/dashboard/users', icon: Users, label: 'Usuários', resource: 'users' },
    { href: '/dashboard/roles', icon: ShieldCheck, label: 'Grupos', resource: 'roles' },
    { href: '/dashboard/invites', icon: MailIcon, label: 'Convites', resource: 'invites' },
    { href: '/dashboard/sessions', icon: Globe, label: 'Sessões', resource: 'sessions' },
    { href: '/dashboard/audit', icon: Activity, label: 'Auditoria', resource: 'audit_logs' },
  ]},
  { label: 'GERADOR', icon: Gauge, items: [
    { href: '/dashboard/manutencao', icon: Wrench, label: 'Manutenções', resource: 'generator' },
  ]},
  { label: 'CONFIGURAÇÕES', icon: SlidersHorizontal, items: [
    { href: '/dashboard/settings/appearance', icon: Settings, label: 'Personalização', resource: 'settings' },
    { href: '/dashboard/settings/auth', icon: Key, label: 'Autenticação', resource: 'settings' },
    { href: '/dashboard/settings/email', icon: MailIcon, label: 'Email', resource: 'settings' },
    { href: '/dashboard/settings/security', icon: Lock, label: 'Segurança', resource: 'settings' },
  ]},
];
```

(O item usa `resource: 'generator'`, não `'maintenance'`, propositalmente — o link do menu fica
visível para quem tem `generator:read`, a mesma permissão que abre a página; os botões internos de
criar/editar/excluir dentro da página é que checam `maintenance:create/update/delete`
individualmente, como implementado na Task 4.)

- [ ] **Step 2: Atualizar `README.md`**

Adicionar uma linha na seção "Sobre este projeto (gerador-web)" (criada no Plano A), logo após o
parágrafo existente:

```markdown

### Manutenções do gerador

Rota `/dashboard/manutencao` (permissão `generator:read` para ver, `maintenance:create` /
`maintenance:update` / `maintenance:delete` para as ações de escrita) — CRUD de registros de
manutenção (abastecimento, troca de óleo, aditivo, bateria, limpeza, defeitos/avarias), com
upload de fotos/comprovantes em `public/uploads/manutencoes/`.
```

- [ ] **Step 3: Atualizar `CODEBASE.md`**

Na tabela de `actions/`, adicionar a linha:

```markdown
| `manutencao.ts` | CRUD de registros de manutenção do gerador + upload de anexos |
```

- [ ] **Step 4: Validação end-to-end local**

```bash
cd gerador-web
cp .env.example .env
```

(Se já existir um `.env` de tasks anteriores, reaproveitar — não sobrescrever.)

```bash
docker compose up -d --build
sleep 15
```

Rodar o seed de permissões dentro do banco já em pé (usando as credenciais do `.env`):

```bash
DATABASE_URL="postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:5434/<POSTGRES_DB>" node seed-generator-permissions.js
```

Acessar `http://localhost:3001` no navegador (ou via `curl` para uma checagem básica):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/dashboard/manutencao
```

Expected: `307` (redireciona para `/login`, já que não há sessão — confirma que a rota existe e
está protegida, não retorna 404).

Se o Setup Wizard ainda não foi completado nesta instância, complete-o (cria o usuário Owner),
faça login, e navegue manualmente até "GERADOR → Manutenções" no menu — confirme que:
1. O item de menu aparece (Owner tem acesso total).
2. A tela carrega vazia ("Nenhum registro encontrado").
3. "Nova Manutenção" abre o modal, permite escolher tipo/data/quantidade/anexar uma foto, e salvar
   cria a linha na tabela.
4. Editar e excluir funcionam.

```bash
docker compose down
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/alexb/OneDrive/Projetos/Gerador/gerador-web
git add src/components/dashboard/dashboard-shell.tsx README.md CODEBASE.md
git commit -m "$(cat <<'EOF'
Add Manutenções nav item and update docs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
