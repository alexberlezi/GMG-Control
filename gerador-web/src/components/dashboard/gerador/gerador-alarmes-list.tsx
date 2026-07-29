'use client';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { AlarmeCard } from '@/lib/gerador-utils';

export function GeradorAlarmesList({ alarmes }: { alarmes: AlarmeCard[] }) {
  const nivelIcon = {
    CRITICO: <AlertTriangle size={18} className="text-red-500" />,
    AVISO: <AlertCircle size={18} className="text-yellow-500" />,
    INFO: <Info size={18} className="text-blue-500" />,
  };

  const nivelColor = {
    CRITICO: 'bg-red-50/30 dark:bg-red-950/30 border-l-4 border-red-500',
    AVISO: 'bg-yellow-50/30 dark:bg-yellow-950/30 border-l-4 border-yellow-500',
    INFO: 'bg-blue-50/30 dark:bg-blue-950/30 border-l-4 border-blue-500',
  };

  const nivelText = {
    CRITICO: 'text-red-700 dark:text-red-300',
    AVISO: 'text-yellow-700 dark:text-yellow-300',
    INFO: 'text-blue-700 dark:text-blue-300',
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-on-surface">Alarmes Recentes</h3>
        {alarmes.length > 0 && (
          <Link href="/dashboard/gerador/alarmes" className="flex items-center gap-1 text-sm text-primary hover:text-primary/80">
            Ver todos
            <ChevronRight size={16} />
          </Link>
        )}
      </div>

      {alarmes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
          <AlertCircle size={32} className="mb-3 opacity-50" />
          <p>Nenhum alarme registrado</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alarmes.slice(0, 5).map((alarme) => (
            <div key={alarme.id} className={`p-4 rounded-lg ${nivelColor[alarme.nivel]}`}>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{nivelIcon[alarme.nivel]}</div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${nivelText[alarme.nivel]}`}>{alarme.titulo}</p>
                  {alarme.descricao && (
                    <p className="text-xs text-on-surface-variant mt-1">{alarme.descricao}</p>
                  )}
                  {alarme.valor !== null && (
                    <p className="text-xs text-on-surface-variant mt-1">
                      Valor: {alarme.valor}{alarme.unidade ? ' ' + alarme.unidade : ''}
                    </p>
                  )}
                  <p className="text-xs text-on-surface-variant mt-2">
                    {formatDistanceToNow(alarme.acionadoEm, {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
                {alarme.resolvido && (
                  <div className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                    ✓ Resolvido
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
