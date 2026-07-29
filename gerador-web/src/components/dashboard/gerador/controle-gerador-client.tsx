'use client';

import { Power, Clock, AlertCircle, Zap } from 'lucide-react';
import type { LeituraAtual } from '@/lib/gerador-db';

interface ControleGeradorClientProps {
  leitura: LeituraAtual | null;
  estaLigado: boolean;
}

export function ControleGeradorClient({ leitura, estaLigado }: ControleGeradorClientProps) {
  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="card p-6 border-2" style={{ borderColor: estaLigado ? 'var(--color-success)' : 'var(--color-error)' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-on-surface-variant uppercase tracking-wide">Status</p>
            <p className="text-4xl font-bold text-on-surface mt-2">
              {estaLigado ? '🟢 Ligado' : '🔴 Desligado'}
            </p>
            {leitura && (
              <p className="text-xs text-on-surface-variant mt-3">
                Última verificação: {leitura.time.toLocaleTimeString('pt-BR')}
              </p>
            )}
          </div>
          <div style={{
            padding: '1.5rem',
            borderRadius: '1.5rem',
            backgroundColor: estaLigado ? 'var(--color-success)' : 'var(--color-error)',
            opacity: 0.2,
            color: estaLigado ? 'var(--color-success)' : 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Power size={56} />
          </div>
        </div>
      </div>

      {/* Operação em tempo real */}
      {estaLigado && leitura && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5">
            <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">RPM</p>
            <p className="text-3xl font-bold text-on-surface mt-2">{leitura.rpm}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Temperatura</p>
            <p className="text-3xl font-bold text-on-surface mt-2">
              {leitura.temperatura_c !== null ? `${leitura.temperatura_c}°C` : '—'}
            </p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Combustível</p>
            <p className="text-3xl font-bold text-on-surface mt-2">{leitura.combustivel_pct}%</p>
          </div>
        </div>
      )}

      {/* Controle Form */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
          <Zap size={20} />
          Operação
        </h2>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">
            Motivo da Operação
          </label>
          <select
            className="w-full px-4 py-2 border border-outline-variant/30 rounded-lg bg-surface text-on-surface"
            disabled
          >
            <option>Ciclo Semanal</option>
            <option>Manutenção</option>
            <option>Falta de Energia</option>
            <option>Teste</option>
            <option>Manual</option>
            <option>Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">
            Observações (opcional)
          </label>
          <textarea
            className="w-full px-4 py-3 border border-outline-variant/30 rounded-lg bg-surface text-on-surface placeholder-on-surface-variant/50"
            rows={3}
            placeholder="Motivo ou notas adicionais..."
            disabled
          />
        </div>

        <div className="flex gap-3 flex-col sm:flex-row">
          <button
            className="flex-1 px-4 py-3 rounded-lg bg-primary text-on-primary font-medium flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
            disabled
            title="Funcionalidade em desenvolvimento"
          >
            <Power size={20} />
            {estaLigado ? 'Desligar' : 'Ligar'}
          </button>
          <div className="alert alert-info flex items-center gap-2 flex-1">
            <AlertCircle size={18} className="shrink-0" />
            <span className="text-sm">Funcionalidade em desenvolvimento</span>
          </div>
        </div>
      </div>

      {/* Histórico rápido */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Clock size={20} />
          Últimos Ciclos
        </h2>
        <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
          <Clock size={40} className="opacity-30 mb-3" />
          <p className="text-sm">
            Nenhum registro de operação ainda
          </p>
          <p className="text-xs mt-1 opacity-70">
            Os ciclos aparecerão aqui quando o gerador ligar/desligar
          </p>
        </div>
      </div>

      {/* Informativo */}
      <div className="alert alert-info">
        <AlertCircle size={20} className="shrink-0" />
        <div>
          <p className="font-medium">Próximas etapas</p>
          <p className="text-sm opacity-90 mt-1">
            Esta tela permite controlar manualmente o gerador. A programação de ciclos automáticos será adicionada em breve.
          </p>
        </div>
      </div>
    </div>
  );
}
