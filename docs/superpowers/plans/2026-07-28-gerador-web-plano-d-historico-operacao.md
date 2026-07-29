# Gerador Web — Plano D: Histórico de Operação Implementation Plan

**Goal:** Criar página `/dashboard/gerador/historico` mostrando cada ciclo de operação do gerador (ligamento/desligamento), com tempo de operação, combustível consumido e motivo da operação.

**Architecture:** Server Component para listagem, com filtros por período e motivo. Dados persistidos em nova tabela Prisma `RegistroOperacao`.

---

## Task 1: Schema Prisma — modelo de operação

**Files:**
- Modify: `gerador-web/prisma/schema.prisma`

**Step 1: Adicionar enum e modelo**

```prisma
enum MotivoOperacao {
  CICLO_SEMANAL
  MANUTENÇÃO
  FALTA_ENERGIA
  TESTE
  MANUAL
  OUTRO
}

model RegistroOperacao {
  id               String          @id @default(cuid())
  dataHoraInicio   DateTime
  dataHoraFim      DateTime?
  tempoOperacao    Int?            // em minutos, calculado ao desligar
  combustivelUsado Decimal?        // em litros
  motivo           MotivoOperacao
  observacoes      String?
  usuarioId        String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  usuario User? @relation(fields: [usuarioId], references: [id], onDelete: SetNull)

  @@index([dataHoraInicio])
  @@index([motivo])
}
```

Adicionar ao modelo `User`:
```prisma
operacoes RegistroOperacao[]
```

**Step 2: Criar migration**

```bash
cd gerador-web
npx prisma migrate dev --name add_operation_records
```

---

## Task 2: Página de histórico

**Files:**
- Create: `gerador-web/src/app/dashboard/gerador/historico/page.tsx`

Página Server Component mostrando tabela com filtros por período.

---

## Task 3: Componente visual

**Files:**
- Create: `gerador-web/src/components/dashboard/gerador/historico-operacao-client.tsx`

Componente Client com tabela responsiva, badges de motivo, e cálculos de tempo/combustível.

---

## Task 4: Tela de Controle (Visual)

**Files:**
- Create: `gerador-web/src/app/dashboard/gerador/controle/page.tsx`

Página visual mostrando:
- Status atual (ligado/desligado)
- Botão de ligar/desligar (desabilitado, apenas visual)
- Seletor de motivo
- Campo de observações
- Histórico de operações recentes

---

## Task 5: Adicionar ao menu

Modificar `src/components/dashboard/dashboard-shell.tsx` para adicionar links ao histórico e controle.

Importar ícones `History` e `Power` do lucide-react.
