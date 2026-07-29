'use client';

import { AlertTriangle } from 'lucide-react';
import type { LeituraAtual } from '@/lib/gerador-db';

export function GeradorStatusCards({ leitura }: { leitura: LeituraAtual }) {
  const isOperando = leitura.motor_status === 'Rodando';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Status do Motor */}
      <div className="card p-5">
        <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Status Motor</p>
        <p className="text-2xl font-bold text-on-surface mt-2">
          {isOperando ? '🟢 Rodando' : '🔴 Parado'}
        </p>
      </div>

      {/* RPM */}
      <div className="card p-5">
        <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">RPM</p>
        <p className="text-2xl font-bold text-on-surface mt-2">{leitura.rpm ?? '—'}</p>
      </div>

      {/* Temperatura */}
      <div className={`card p-5 ${leitura.temperatura_invalida ? 'border-2 border-warning bg-warning-container/30' : ''}`}>
        <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Temperatura</p>
        <p className="text-2xl font-bold text-on-surface mt-2">
          {leitura.temperatura_invalida ? '⚠️ Sensor' : `${leitura.temperatura}°C`}
        </p>
        {leitura.temperatura_invalida && (
          <div className="mt-3 flex items-start gap-2 text-xs text-warning">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p>Sensor de Temperatura Fora de Operação</p>
          </div>
        )}
      </div>

      {/* Combustível */}
      <div className="card p-5">
        <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Combustível</p>
        <p className="text-2xl font-bold text-on-surface mt-2">{leitura.nivel_combustivel ?? '—'}%</p>
      </div>
    </div>
  );
}
