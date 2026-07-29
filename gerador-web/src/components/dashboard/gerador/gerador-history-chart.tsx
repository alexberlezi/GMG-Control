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

  const chartData = dados.map(item => {
    // Calculate average voltage and current across 3 phases
    const avgRedeVolts = item.rede_volts_l1 && item.rede_volts_l2 && item.rede_volts_l3
      ? Math.round((item.rede_volts_l1 + item.rede_volts_l2 + item.rede_volts_l3) / 3)
      : null;

    const avgGeradorVolts = item.gerador_volts_l1 && item.gerador_volts_l2 && item.gerador_volts_l3
      ? Math.round((item.gerador_volts_l1 + item.gerador_volts_l2 + item.gerador_volts_l3) / 3)
      : null;

    const avgGeradorAmps = item.gerador_amps_l1 && item.gerador_amps_l2 && item.gerador_amps_l3
      ? Math.round((item.gerador_amps_l1 + item.gerador_amps_l2 + item.gerador_amps_l3) / 3 * 10) / 10
      : null;

    return {
      tempo: item.tempo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      temperatura: item.temperatura,
      rpm: item.rpm ? Math.round(item.rpm / 100) : null,
      combustivel: item.combustivel,
      rede_volts: avgRedeVolts,
      gerador_volts: avgGeradorVolts,
      gerador_amps: avgGeradorAmps,
    };
  });

  return (
    <div className="space-y-6">
      {/* Gráfico de Temperatura, RPM e Combustível */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-on-surface mb-4">Motor - Temperatura, RPM e Combustível</h3>
        <ResponsiveContainer width="100%" height={250}>
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
      </div>

      {/* Gráfico de Tensão */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-on-surface mb-4">Tensão (Rede e Gerador)</h3>
        <ResponsiveContainer width="100%" height={250}>
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
              dataKey="rede_volts"
              stroke="#9b59b6"
              dot={false}
              isAnimationActive={false}
              name="Tensão Rede (V médio)"
            />
            <Line
              type="monotone"
              dataKey="gerador_volts"
              stroke="#3498db"
              dot={false}
              isAnimationActive={false}
              name="Tensão Gerador (V médio)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de Corrente */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-on-surface mb-4">Corrente do Gerador</h3>
        <ResponsiveContainer width="100%" height={250}>
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
              dataKey="gerador_amps"
              stroke="#e74c3c"
              dot={false}
              isAnimationActive={false}
              name="Corrente (A médio)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
