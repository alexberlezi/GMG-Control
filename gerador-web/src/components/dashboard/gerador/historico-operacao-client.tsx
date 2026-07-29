'use client';

import { useState, useMemo } from 'react';
import { Calendar, Filter } from 'lucide-react';

interface RegistroOperacao {
  id: string;
  inicio: Date;
  fim: Date | null;
  tempo_operacao_minutos?: number;
  combustivel_consumido?: number;
  motivo: string;
  observacoes?: string;
  usuario: { name: string } | null;
}

const PERIODO_OPTIONS = [
  { value: 'hoje', label: 'Hoje', days: 0 },
  { value: 'semana', label: 'Última Semana', days: 7 },
  { value: 'mes', label: 'Último Mês', days: 30 },
];

const MOTIVO_LABELS: Record<string, string> = {
  CICLO_SEMANAL: 'Ciclo Semanal',
  MANUTENCAO: 'Manutenção',
  FALTA_ENERGIA: 'Falta de Energia',
  TESTE: 'Teste',
  MANUAL: 'Manual',
  OUTRO: 'Outro',
};

const MOTIVO_COLORS: Record<string, { badge: string; dot: string }> = {
  CICLO_SEMANAL: { badge: 'bg-info/20 text-info', dot: 'bg-info' },
  MANUTENCAO: { badge: 'bg-warning/20 text-warning', dot: 'bg-warning' },
  FALTA_ENERGIA: { badge: 'bg-error/20 text-error', dot: 'bg-error' },
  TESTE: { badge: 'bg-secondary/20 text-secondary', dot: 'bg-secondary' },
  MANUAL: { badge: 'bg-tertiary/20 text-tertiary', dot: 'bg-tertiary' },
  OUTRO: { badge: 'bg-outline/20 text-on-surface-variant', dot: 'bg-outline-variant' },
};

function formatData(date: Date | string) {
  return new Date(date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDuration(minutos: number | undefined): string {
  if (!minutos) return '—';
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  if (horas === 0) return `${mins}m`;
  return `${horas}h ${mins}m`;
}

interface HistoricoOperacaoClientProps {
  registros: RegistroOperacao[];
  periodo?: string;
  motivo?: string;
}

export function HistoricoOperacaoClient({
  registros,
  periodo: periodoParam = 'todos',
  motivo: motivoParam,
}: HistoricoOperacaoClientProps) {
  const [selectedPeriodo, setSelectedPeriodo] = useState(periodoParam);
  const [selectedMotivo, setSelectedMotivo] = useState(motivoParam || 'TODOS');

  const filtered = useMemo(() => {
    let list = [...registros];

    // Filter by period
    if (selectedPeriodo !== 'todos') {
      const option = PERIODO_OPTIONS.find((o) => o.value === selectedPeriodo);
      if (option) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - option.days);
        list = list.filter((r) => new Date(r.inicio) >= cutoffDate);
      }
    }

    // Filter by motivo
    if (selectedMotivo !== 'TODOS') {
      list = list.filter((r) => r.motivo === selectedMotivo);
    }

    return list.sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());
  }, [registros, selectedPeriodo, selectedMotivo]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Histórico de Operação</h1>
        <p className="text-sm text-on-surface-variant">
          Registro de cada ciclo de operação do gerador.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-on-surface-variant" />
          <h3 className="text-sm font-semibold text-on-surface">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Period Filter */}
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-2 uppercase">
              Período
            </label>
            <div className="flex gap-2">
              {PERIODO_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedPeriodo(option.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedPeriodo === option.value
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo Filter */}
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-2 uppercase">
              Motivo
            </label>
            <select
              value={selectedMotivo}
              onChange={(e) => setSelectedMotivo(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface"
            >
              <option value="TODOS">Todos os Motivos</option>
              {Object.entries(MOTIVO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar size={40} className="mx-auto mb-3 text-on-surface-variant/50" />
            <p className="text-on-surface-variant mb-1">Nenhum ciclo encontrado</p>
            <p className="text-xs text-on-surface-variant/70">
              Tente ajustar os filtros ou aguarde novos ciclos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container-low">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase">
                    Início
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase">
                    Término
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase">
                    Duração
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase">
                    Combustível (L)
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase">
                    Motivo
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase">
                    Usuário
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtered.map((registro) => {
                  const colors = MOTIVO_COLORS[registro.motivo as keyof typeof MOTIVO_COLORS] || MOTIVO_COLORS.OUTRO;
                  const motivoLabel = MOTIVO_LABELS[registro.motivo as keyof typeof MOTIVO_LABELS] || registro.motivo;

                  return (
                    <tr key={registro.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-5 py-4 text-sm text-on-surface">
                        {formatData(registro.inicio)}
                      </td>
                      <td className="px-5 py-4 text-sm text-on-surface">
                        {registro.fim ? formatData(registro.fim) : '—'}
                      </td>
                      <td className="px-5 py-4 text-sm text-on-surface">
                        {formatDuration(registro.tempo_operacao_minutos)}
                      </td>
                      <td className="px-5 py-4 text-sm text-on-surface">
                        {registro.combustivel_consumido ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                          {motivoLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">
                        {registro.usuario?.name || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Observações Card */}
      {filtered.length > 0 && filtered.some((r) => r.observacoes) && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Observações</h3>
          <div className="space-y-2">
            {filtered
              .filter((r) => r.observacoes)
              .map((registro) => (
                <div key={registro.id} className="text-sm p-3 rounded-lg bg-surface-container-low">
                  <p className="text-xs text-on-surface-variant font-medium mb-1">
                    {formatData(registro.inicio)}
                  </p>
                  <p className="text-on-surface">{registro.observacoes}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
