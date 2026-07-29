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
