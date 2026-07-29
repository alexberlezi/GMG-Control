# Gerador Web — Plano E: Tela de Controle (Visual) Implementation Plan

**Goal:** Criar página `/dashboard/gerador/controle` com interface visual para ligar/desligar o gerador. A funcionalidade será implementada depois; por enquanto é apenas o visual.

**Architecture:** Server Component com Status quo. Client Component com form interativo (desabilitado).

---

## Task 1: Página de Controle

**Files:**
- Create: `gerador-web/src/app/dashboard/gerador/controle/page.tsx`

Página Server Component que exibe:
1. Status atual (simulado: conectando ao `getUltimaLeitura()`)
2. Indicador de operação (ligado/desligado/aguardando)
3. Formulário interativo (visual apenas)

```tsx
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { getUltimaLeitura } from '@/lib/gerador-db';
import { ControleGeradorClient } from '@/components/dashboard/gerador/controle-gerador-client';

export default async function ControleGeradorPage() {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'generator', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }

  const leitura = await getUltimaLeitura();
  const estaLigado = leitura?.motor_status === 'Rodando';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Controle do Gerador</h1>
        <p className="text-sm text-on-surface-variant">
          Ligar/desligar e programar ciclos de operação
        </p>
      </div>

      <ControleGeradorClient leitura={leitura} estaLigado={estaLigado} />
    </div>
  );
}
```

---

## Task 2: Componente de Controle

**Files:**
- Create: `gerador-web/src/components/dashboard/gerador/controle-gerador-client.tsx`

Componente Client com:
- Card grande mostrando status (Ligado/Desligado/Aguardando)
- Indicador visual com ícone `Power` colorido
- Tempo de operação atual (se ligado)
- RPM e temperatura em tempo real
- Form com:
  - Seletor de motivo (CICLO_SEMANAL, MANUTENÇÃO, FALTA_ENERGIA, TESTE, MANUAL, OUTRO)
  - Campo de observações
  - Botão "Ligar" / "Desligar" (desabilitado com tooltip "Funcionalidade em desenvolvimento")
- Lista dos últimos 5 ciclos de operação
- Histórico rápido (últimos 24h)

```tsx
'use client';

import { Power, Clock, AlertCircle } from 'lucide-react';
import type { LeituraAtual } from '@/lib/gerador-db';

interface ControleGeradorClientProps {
  leitura: LeituraAtual | null;
  estaLigado: boolean;
}

export function ControleGeradorClient({ leitura, estaLigado }: ControleGeradorClientProps) {
  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="card p-6 border-2 border-primary/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-on-surface-variant uppercase tracking-wide">Status</p>
            <p className="text-3xl font-bold text-on-surface mt-2">
              {estaLigado ? '🟢 Ligado' : '🔴 Desligado'}
            </p>
            {leitura && (
              <p className="text-xs text-on-surface-variant mt-2">
                Última verificação: {leitura.time.toLocaleTimeString('pt-BR')}
              </p>
            )}
          </div>
          <div className={`p-6 rounded-2xl ${estaLigado ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
            <Power size={48} />
          </div>
        </div>
      </div>

      {/* Operação em tempo real */}
      {estaLigado && leitura && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs text-on-surface-variant">RPM</p>
            <p className="text-2xl font-bold text-on-surface mt-1">{leitura.rpm}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-on-surface-variant">Temperatura</p>
            <p className="text-2xl font-bold text-on-surface mt-1">{leitura.temperatura_c || '-'}°C</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-on-surface-variant">Combustível</p>
            <p className="text-2xl font-bold text-on-surface mt-1">{leitura.combustivel_pct}%</p>
          </div>
        </div>
      )}

      {/* Controle Form */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">Operação</h2>
        
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">
            Motivo da Operação
          </label>
          <select 
            className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface"
            disabled
          >
            <option>Ciclo Semanal</option>
            <option>Manutenção</option>
            <option>Falta de Energia</option>
            <option>Teste</option>
            <option>Manual</option>
            <option>Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">
            Observações (opcional)
          </label>
          <textarea 
            className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface"
            rows={3}
            placeholder="Motivo ou notas adicionais..."
            disabled
          />
        </div>

        <div className="flex gap-3">
          <button
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-on-primary font-medium opacity-50 cursor-not-allowed"
            disabled
            title="Funcionalidade em desenvolvimento"
          >
            <Power size={18} className="inline mr-2" />
            {estaLigado ? 'Desligar' : 'Ligar'}
          </button>
          <div className="alert alert-info flex-1">
            <AlertCircle size={16} />
            <span className="text-xs">Funcionalidade em desenvolvimento</span>
          </div>
        </div>
      </div>

      {/* Histórico rápido */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-on-surface mb-4">Últimos Ciclos</h2>
        <p className="text-sm text-on-surface-variant text-center py-8">
          <Clock className="inline mr-2" size={18} />
          Nenhum registro ainda (será preenchido com dados de RegistroOperacao)
        </p>
      </div>
    </div>
  );
}
```

---

## Task 3: Adicionar ao menu

Modificar `src/components/dashboard/dashboard-shell.tsx`:

1. Importar `History` e `Power` do lucide-react
2. Adicionar items ao GERADOR:

```ts
{ label: 'GERADOR', icon: Gauge, items: [
  { href: '/dashboard/gerador', icon: Zap, label: 'Painel do Gerador', resource: 'generator' },
  { href: '/dashboard/gerador/controle', icon: Power, label: 'Controle', resource: 'generator' },
  { href: '/dashboard/gerador/historico', icon: History, label: 'Histórico', resource: 'generator' },
  { href: '/dashboard/manutencao', icon: Wrench, label: 'Manutenções', resource: 'generator' },
]},
```

---

## Task 4: Typecheck e Build

```bash
npx tsc --noEmit
npx next build
```
