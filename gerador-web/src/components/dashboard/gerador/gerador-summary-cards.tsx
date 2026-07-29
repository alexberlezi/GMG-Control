'use client';

import { AlertTriangle, Fuel, Wrench, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DashboardSummary } from '@/lib/gerador-utils';

export function GeradorSummaryCards({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Último Abastecimento */}
      <div className="card p-5 border-l-4 border-blue-500 bg-blue-50/10 dark:bg-blue-950/20">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Último Abastecimento</p>
          </div>
          <Fuel size={20} className="text-blue-600 dark:text-blue-400" />
        </div>
        {summary.ultimoAbastecimento ? (
          <>
            <p className="text-xl font-semibold text-on-surface">
              {summary.ultimoAbastecimento.quantidade}{summary.ultimoAbastecimento.unidade ? ' ' + summary.ultimoAbastecimento.unidade : ''}
            </p>
            <p className="text-xs text-on-surface-variant mt-2">
              {formatDistanceToNow(summary.ultimoAbastecimento.data, {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">Sem registro</p>
        )}
      </div>

      {/* Última Manutenção */}
      <div className="card p-5 border-l-4 border-green-500 bg-green-50/10 dark:bg-green-950/20">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Última Manutenção</p>
          </div>
          <Wrench size={20} className="text-green-600 dark:text-green-400" />
        </div>
        {summary.ultimaManutencao ? (
          <>
            <p className="text-xl font-semibold text-on-surface">{summary.ultimaManutencao.tipo}</p>
            <p className="text-xs text-on-surface-variant mt-2">
              {formatDistanceToNow(summary.ultimaManutencao.data, {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">Sem registro</p>
        )}
      </div>

      {/* Alarmes Críticos */}
      <div className={`card p-5 border-l-4 ${
        summary.alarmesCriticos > 0
          ? 'border-red-500 bg-red-50/10 dark:bg-red-950/20'
          : 'border-green-500 bg-green-50/10 dark:bg-green-950/20'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Alarmes Críticos</p>
          </div>
          <AlertTriangle
            size={20}
            className={summary.alarmesCriticos > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
          />
        </div>
        <p className={`text-2xl font-bold ${
          summary.alarmesCriticos > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
        }`}>
          {summary.alarmesCriticos}
        </p>
        <p className="text-xs text-on-surface-variant mt-2">
          {summary.alarmesCriticos === 0 ? 'Sem alertas críticos' : 'Ação necessária'}
        </p>
      </div>

      {/* Alarmes de Aviso */}
      <div className={`card p-5 border-l-4 ${
        summary.alarmesAvisos > 0
          ? 'border-yellow-500 bg-yellow-50/10 dark:bg-yellow-950/20'
          : 'border-green-500 bg-green-50/10 dark:bg-green-950/20'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Avisos</p>
          </div>
          <AlertCircle
            size={20}
            className={summary.alarmesAvisos > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}
          />
        </div>
        <p className={`text-2xl font-bold ${
          summary.alarmesAvisos > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
        }`}>
          {summary.alarmesAvisos}
        </p>
        <p className="text-xs text-on-surface-variant mt-2">
          {summary.alarmesAvisos === 0 ? 'Sem avisos' : 'Monitorar'}
        </p>
      </div>
    </div>
  );
}
