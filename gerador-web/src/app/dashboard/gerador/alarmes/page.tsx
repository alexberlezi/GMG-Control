import { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import { getAlarmes } from '@/lib/gerador-utils';
import { AlarmeDetailsClient } from '@/components/dashboard/gerador/alarme-details-client';

export const metadata: Metadata = {
  title: 'Alarmes do Gerador',
  description: 'Histórico de alarmes e avisos do gerador',
};

export default async function AlarmesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; nivel?: string }>;
}) {
  const params = await searchParams;
  const alarmes = await getAlarmes({
    nivel: (params.nivel as 'CRITICO' | 'AVISO' | 'INFO') || undefined,
  });

  const alarmesCriticos = alarmes.filter((a) => a.nivel === 'CRITICO' && !a.resolvido);
  const alarmesAvisos = alarmes.filter((a) => a.nivel === 'AVISO' && !a.resolvido);
  const alarmesResolvidos = alarmes.filter((a) => a.resolvido);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface flex items-center gap-2">
            <AlertTriangle size={32} className="text-on-surface" />
            Alarmes do Gerador
          </h1>
          <p className="text-on-surface-variant mt-2">
            Histórico de alarmes e avisos do sistema de geração
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-red-500 bg-red-50/10 dark:bg-red-950/20">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Críticos Abertos</p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{alarmesCriticos.length}</p>
          <p className="text-xs text-on-surface-variant mt-2">Requerem ação imediata</p>
        </div>

        <div className="card p-5 border-l-4 border-yellow-500 bg-yellow-50/10 dark:bg-yellow-950/20">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Avisos Abertos</p>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">{alarmesAvisos.length}</p>
          <p className="text-xs text-on-surface-variant mt-2">Monitorar situação</p>
        </div>

        <div className="card p-5 border-l-4 border-green-500 bg-green-50/10 dark:bg-green-950/20">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Resolvidos</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{alarmesResolvidos.length}</p>
          <p className="text-xs text-on-surface-variant mt-2">Histórico</p>
        </div>
      </div>

      {/* Alarmes Críticos */}
      {alarmesCriticos.length > 0 && (
        <div className="card p-6 border-l-4 border-red-500 bg-red-50/10 dark:bg-red-950/20">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-4">
            ⚠️ Alarmes Críticos ({alarmesCriticos.length})
          </h2>
          <div className="space-y-3">
            {alarmesCriticos.map((alarme) => (
              <AlarmeDetailsClient key={alarme.id} alarme={alarme} />
            ))}
          </div>
        </div>
      )}

      {/* Avisos */}
      {alarmesAvisos.length > 0 && (
        <div className="card p-6 border-l-4 border-yellow-500 bg-yellow-50/10 dark:bg-yellow-950/20">
          <h2 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300 mb-4">
            ⚡ Avisos ({alarmesAvisos.length})
          </h2>
          <div className="space-y-3">
            {alarmesAvisos.map((alarme) => (
              <AlarmeDetailsClient key={alarme.id} alarme={alarme} />
            ))}
          </div>
        </div>
      )}

      {/* Resolvidos */}
      {alarmesResolvidos.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer p-6 font-semibold text-on-surface flex items-center gap-2">
            <span>✓ Resolvidos ({alarmesResolvidos.length})</span>
          </summary>
          <div className="p-6 space-y-3 border-t border-outline-variant">
            {alarmesResolvidos.map((alarme) => (
              <AlarmeDetailsClient key={alarme.id} alarme={alarme} />
            ))}
          </div>
        </details>
      )}

      {/* Empty State */}
      {alarmes.length === 0 && (
        <div className="card p-8 flex flex-col items-center justify-center text-center">
          <AlertTriangle size={48} className="text-on-surface-variant/30 mb-4" />
          <p className="text-lg text-on-surface-variant">Nenhum alarme registrado</p>
          <p className="text-sm text-on-surface-variant/60 mt-1">Sistema operando normalmente</p>
        </div>
      )}
    </div>
  );
}
