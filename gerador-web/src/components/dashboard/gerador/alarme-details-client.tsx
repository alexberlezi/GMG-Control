'use client';

import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useState } from 'react';
import type { AlarmeCard } from '@/lib/gerador-utils';

export function AlarmeDetailsClient({ alarme }: { alarme: AlarmeCard }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const nivelIcon = {
    CRITICO: <AlertTriangle size={20} className="text-red-500" />,
    AVISO: <AlertCircle size={20} className="text-yellow-500" />,
    INFO: <Info size={20} className="text-blue-500" />,
  };

  const nivelColor = {
    CRITICO: 'bg-red-50/20 dark:bg-red-950/20 border-l-4 border-red-500',
    AVISO: 'bg-yellow-50/20 dark:bg-yellow-950/20 border-l-4 border-yellow-500',
    INFO: 'bg-blue-50/20 dark:bg-blue-950/20 border-l-4 border-blue-500',
  };

  const nivelBadge = {
    CRITICO: 'bg-red-500/20 text-red-700 dark:text-red-300',
    AVISO: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
    INFO: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  };

  return (
    <div className={`p-4 rounded-lg ${nivelColor[alarme.nivel]}`}>
      <div
        className="flex items-start justify-between cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-shrink-0 mt-1">{nivelIcon[alarme.nivel]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-on-surface">{alarme.titulo}</p>
              <span className={`text-xs px-2 py-0.5 rounded ${nivelBadge[alarme.nivel]}`}>
                {alarme.tipo}
              </span>
            </div>
            {alarme.descricao && (
              <p className="text-sm text-on-surface-variant mt-1">{alarme.descricao}</p>
            )}
            <div className="flex items-center gap-4 mt-2">
              {alarme.valor !== null && (
                <p className="text-sm text-on-surface-variant">
                  <span className="font-medium">Valor:</span> {alarme.valor}
                  {alarme.unidade ? ' ' + alarme.unidade : ''}
                </p>
              )}
              <p className="text-xs text-on-surface-variant">
                {formatDistanceToNow(alarme.acionadoEm, {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
            </div>
          </div>
        </div>
        {alarme.resolvido && (
          <div className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-3 py-1 rounded ml-2 flex-shrink-0">
            ✓ Resolvido
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-on-surface-variant/10 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-on-surface-variant font-medium">Acionado em</p>
              <p className="text-on-surface mt-1">
                {format(alarme.acionadoEm, "dd 'de' MMMM 'de' yyyy 'às' HH:mm:ss", {
                  locale: ptBR,
                })}
              </p>
            </div>
            <div>
              <p className="text-on-surface-variant font-medium">Nível</p>
              <p className="text-on-surface mt-1">{alarme.nivel}</p>
            </div>
          </div>
          <div>
            <p className="text-on-surface-variant font-medium text-sm">Tipo de Alarme</p>
            <p className="text-on-surface mt-1 text-sm">{alarme.tipo}</p>
          </div>
        </div>
      )}
    </div>
  );
}
