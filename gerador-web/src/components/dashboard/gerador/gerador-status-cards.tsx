'use client';

import { AlertTriangle, RotateCcw, Zap, Radio, Battery, Wifi } from 'lucide-react';
import type { LeituraAtual } from '@/lib/gerador-db';

interface MetricCardProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}

function MetricCard({ label, value, unit, icon, highlight }: MetricCardProps) {
  return (
    <div className={`flex flex-col gap-2 p-4 rounded-lg transition-all ${
      highlight ? 'bg-surface-container-high/60 border-l-4 border-primary' : 'bg-surface-container/50'
    }`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-on-surface-variant opacity-60 text-sm">{icon}</span>}
        <span className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold text-on-surface leading-tight">
        {value === null || value === undefined ? '—' : `${value}${unit ? ' ' + unit : ''}`}
      </p>
    </div>
  );
}

interface GroupBlockProps {
  title: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'purple' | 'orange' | 'green' | 'red' | 'cyan';
  children: React.ReactNode;
  alert?: { icon: React.ReactNode; message: string };
}

function GroupBlock({ title, icon, color = 'blue', children, alert }: GroupBlockProps) {
  const colorClass = {
    blue: 'border-l-4 border-blue-500 bg-blue-50/10 dark:bg-blue-950/20',
    purple: 'border-l-4 border-purple-500 bg-purple-50/10 dark:bg-purple-950/20',
    orange: 'border-l-4 border-orange-500 bg-orange-50/10 dark:bg-orange-950/20',
    green: 'border-l-4 border-green-500 bg-green-50/10 dark:bg-green-950/20',
    red: 'border-l-4 border-red-500 bg-red-50/10 dark:bg-red-950/20',
    cyan: 'border-l-4 border-cyan-500 bg-cyan-50/10 dark:bg-cyan-950/20',
  }[color];

  const titleColorClass = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    orange: 'text-orange-600 dark:text-orange-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    cyan: 'text-cyan-600 dark:text-cyan-400',
  }[color];

  return (
    <div className={`card p-6 ${colorClass}`}>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          {icon && <span className={`${titleColorClass} flex-shrink-0`}>{icon}</span>}
          <h3 className={`text-lg font-semibold ${titleColorClass}`}>{title}</h3>
        </div>
        {alert && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-warning-container/20 rounded border border-warning/30">
            <span className="text-warning mt-0.5 flex-shrink-0">{alert.icon}</span>
            <p className="text-sm text-on-surface-variant">{alert.message}</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {children}
      </div>
    </div>
  );
}

export function GeradorStatusCards({ leitura }: { leitura: LeituraAtual }) {
  const isOperando = leitura.motor_status === 'Rodando';
  const networkAvailable = leitura.status_concessionaria === 'Disponível';

  return (
    <div className="space-y-5">
      {/* Status Principal do Motor - Hero Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={`card p-8 flex flex-col items-center justify-center rounded-xl transition-all ${
          isOperando
            ? 'bg-gradient-to-br from-green-50/30 to-green-50/10 dark:from-green-950/40 dark:to-green-950/20 border-2 border-green-500/60'
            : 'bg-gradient-to-br from-red-50/30 to-red-50/10 dark:from-red-950/40 dark:to-red-950/20 border-2 border-red-500/60'
        }`}>
          <div className="text-6xl mb-4">{isOperando ? '🟢' : '🔴'}</div>
          <p className={`text-3xl font-bold tracking-tight ${isOperando ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
            {isOperando ? 'RODANDO' : 'PARADO'}
          </p>
          <p className="text-sm text-on-surface-variant mt-2">Status do Motor</p>
        </div>

        <GroupBlock title="Motor" icon={<RotateCcw size={20} />} color="orange">
          <MetricCard label="RPM" value={leitura.rpm} />
          <MetricCard
            label="Temperatura"
            value={leitura.temperatura_invalida ? '⚠️' : leitura.temperatura}
            unit={leitura.temperatura_invalida ? '' : '°C'}
            highlight={leitura.temperatura_invalida}
          />
          <MetricCard label="Combustível" value={leitura.nivel_combustivel} unit="%" />
        </GroupBlock>
      </div>

      {/* Tensões - Rede e Gerador */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GroupBlock title="Tensão da Rede" icon={<Wifi size={20} />} color="blue">
          <MetricCard label="L1" value={leitura.rede_volts_l1} unit="V" />
          <MetricCard label="L2" value={leitura.rede_volts_l2} unit="V" />
          <MetricCard label="L3" value={leitura.rede_volts_l3} unit="V" />
        </GroupBlock>

        <GroupBlock title="Tensão do Gerador" icon={<Zap size={20} />} color="purple">
          <MetricCard label="L1" value={leitura.gerador_volts_l1} unit="V" highlight />
          <MetricCard label="L2" value={leitura.gerador_volts_l2} unit="V" highlight />
          <MetricCard label="L3" value={leitura.gerador_volts_l3} unit="V" highlight />
        </GroupBlock>
      </div>

      {/* Correntes e Energia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GroupBlock title="Corrente do Gerador" icon={<Radio size={20} />} color="cyan">
          <MetricCard label="L1" value={leitura.gerador_amps_l1} unit="A" highlight />
          <MetricCard label="L2" value={leitura.gerador_amps_l2} unit="A" highlight />
          <MetricCard label="L3" value={leitura.gerador_amps_l3} unit="A" highlight />
        </GroupBlock>

        <GroupBlock title="Energia" icon={<Zap size={20} />} color="green">
          <MetricCard label="Ativa" value={leitura.energia_kwh} unit="kWh" />
          <MetricCard label="Aparente" value={leitura.energia_kvah} unit="kVAh" />
          <MetricCard label="Reativa" value={leitura.energia_kvarh} unit="kVArh" />
          <MetricCard label="Partidas" value={leitura.partidas} />
        </GroupBlock>
      </div>

      {/* Sistema e Rede */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GroupBlock
          title="Sistema"
          icon={<Battery size={20} />}
          color="red"
          alert={leitura.temperatura_invalida ? {
            icon: <AlertTriangle size={16} />,
            message: 'Sensor de temperatura fora de operação'
          } : undefined}
        >
          <MetricCard label="Bateria" value={leitura.bateria_v} unit="V" />
          <MetricCard label="Frequência" value={leitura.rede_freq_hz} unit="Hz" />
        </GroupBlock>

        <GroupBlock
          title="Rede"
          icon={<Wifi size={20} />}
          color="green"
          alert={!networkAvailable ? {
            icon: <AlertTriangle size={16} />,
            message: 'Rede da concessionária indisponível'
          } : undefined}
        >
          <MetricCard
            label="Concessionária"
            value={leitura.status_concessionaria}
            highlight={!networkAvailable}
          />
          <MetricCard label="Modo" value={leitura.modo_operacao} />
        </GroupBlock>
      </div>
    </div>
  );
}
