'use client';

import { useState } from 'react';
import { AlertTriangle, Power, PowerOff } from 'lucide-react';
import type { LeituraAtual } from '@/lib/gerador-db';

const MOTIVOS_OPERACAO = [
  { value: 'CICLO_SEMANAL', label: 'Ciclo Semanal' },
  { value: 'MANUTENCAO', label: 'Manutenção' },
  { value: 'FALTA_ENERGIA', label: 'Falta de Energia' },
  { value: 'TESTE', label: 'Teste' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'OUTRO', label: 'Outro' },
];

interface ControleGeradorClientProps {
  isLigado: boolean | undefined;
  leitura: LeituraAtual | null;
}

export function ControleGeradorClient({ isLigado, leitura }: ControleGeradorClientProps) {
  const [motivo, setMotivo] = useState('CICLO_SEMANAL');
  const [observacoes, setObservacoes] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Controle do Gerador</h1>
        <p className="text-sm text-on-surface-variant">
          Operação remota e controle do gerador Deep Sea 4520 MKII.
        </p>
      </div>

      {/* Status Card */}
      <div className={`card p-6 border-2 ${isLigado ? 'border-success bg-surface-container-high/50' : 'border-outline bg-surface-container-low/30'}`}>
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            {isLigado ? (
              <Power className="text-success" size={48} />
            ) : (
              <PowerOff className="text-outline" size={48} />
            )}
          </div>
          <div className="flex-grow">
            <p className="text-sm text-on-surface-variant mb-1">Status Atual</p>
            <p className="text-3xl font-bold text-on-surface">
              {isLigado ? '🟢 Ligado' : '🔴 Desligado'}
            </p>
          </div>
        </div>

        {/* Real-time Data when running */}
        {isLigado && leitura && (
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-outline-variant/20 pt-6">
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">RPM</p>
              <p className="text-xl font-semibold text-on-surface mt-1">{leitura.rpm ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Temperatura</p>
              <p className="text-xl font-semibold text-on-surface mt-1">
                {leitura.temperatura_invalida ? '⚠️ Sensor' : `${leitura.temperatura}°C`}
              </p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Combustível</p>
              <p className="text-xl font-semibold text-on-surface mt-1">{leitura.nivel_combustivel ?? '—'}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Control Form */}
      <div className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold text-on-surface">Operação</h2>

        <div className="space-y-4">
          {/* Reason Selector */}
          <div>
            <label htmlFor="motivo" className="block text-sm font-medium text-on-surface mb-2">
              Motivo da Operação
            </label>
            <select
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-on-surface disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {MOTIVOS_OPERACAO.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Observations */}
          <div>
            <label htmlFor="observacoes" className="block text-sm font-medium text-on-surface mb-2">
              Observações (opcional)
            </label>
            <textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled
              placeholder="Adicione notas sobre a operação..."
              rows={4}
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-on-surface placeholder-on-surface-variant/50 disabled:opacity-60 disabled:cursor-not-allowed resize-none"
            />
          </div>
        </div>

        {/* Development Alert */}
        <div className="alert alert-warning">
          <AlertTriangle size={20} className="shrink-0" />
          <p>Funcionalidade em desenvolvimento — controles desabilitados por enquanto.</p>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            disabled
            className="px-6 py-3 rounded-lg font-medium bg-success text-on-success disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            Ligar Gerador
          </button>
          <button
            disabled
            className="px-6 py-3 rounded-lg font-medium bg-error text-on-error disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            Desligar Gerador
          </button>
        </div>
      </div>

      {/* Recent Operations */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-on-surface mb-4">Últimos Ciclos</h2>
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            Nenhum ciclo registrado ainda.
          </p>
        </div>
      </div>
    </div>
  );
}
