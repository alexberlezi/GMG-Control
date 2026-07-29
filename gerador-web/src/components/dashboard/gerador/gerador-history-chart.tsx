'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { HistoricoGeradorPonto } from '@/lib/gerador-db';

interface GeradorHistoryChartProps {
  dados: HistoricoGeradorPonto[];
}

export function GeradorHistoryChart({ dados }: GeradorHistoryChartProps) {
  if (!dados || dados.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-variant">
        <p>Sem dados de histórico disponíveis</p>
      </div>
    );
  }

  const chartData = dados.map(item => ({
    tempo: item.tempo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    temperatura: item.temperatura,
    rpm: item.rpm ? Math.round(item.rpm / 100) : null, // Scale down for better visualization
    combustivel: item.combustivel,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" opacity={0.2} />
        <XAxis
          dataKey="tempo"
          stroke="var(--color-on-surface-variant)"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="var(--color-on-surface-variant)"
          style={{ fontSize: '12px' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: '8px',
          }}
          labelStyle={{ color: 'var(--color-on-surface)' }}
        />
        <Legend wrapperStyle={{ color: 'var(--color-on-surface-variant)' }} />
        <Line
          type="monotone"
          dataKey="temperatura"
          stroke="#ff6b6b"
          dot={false}
          isAnimationActive={false}
          name="Temperatura (°C)"
        />
        <Line
          type="monotone"
          dataKey="rpm"
          stroke="#4ecdc4"
          dot={false}
          isAnimationActive={false}
          name="RPM (÷100)"
        />
        <Line
          type="monotone"
          dataKey="combustivel"
          stroke="#ffa07a"
          dot={false}
          isAnimationActive={false}
          name="Combustível (%)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
