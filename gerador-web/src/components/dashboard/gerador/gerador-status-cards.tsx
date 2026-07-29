import type { LeituraAtual } from '@/lib/gerador-db';
import { Fuel, Gauge as GaugeIcon, Zap, RotateCw, AlertTriangle } from 'lucide-react';

interface GeradorStatusCardsProps {
  leitura: LeituraAtual;
}

function fmt(value: string | number, casas = 1): string {
  return Number(value).toFixed(casas);
}

const MODO_BADGE: Record<string, string> = {
  'Automático': 'badge-success',
  'Manual': 'badge-primary',
  'Teste': 'badge-warning',
  'Parado (Stop)': 'badge-neutral',
};

export function GeradorStatusCards({ leitura }: GeradorStatusCardsProps) {
  const redeOk = leitura.status_concessionaria === 'Rede OK';
  const motorRodando = leitura.motor_status === 'Rodando';

  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-wrap items-center gap-3">
        <span className={`badge ${MODO_BADGE[leitura.modo_operacao] || 'badge-neutral'}`}>
          Modo: {leitura.modo_operacao}
        </span>
        <span className={`badge ${redeOk ? 'badge-success' : 'badge-danger'}`}>
          {leitura.status_concessionaria}
        </span>
        <span className={`badge ${motorRodando ? 'badge-success' : 'badge-neutral'}`}>
          Motor: {leitura.motor_status}
        </span>
        <span className="text-xs text-on-surface-variant ml-auto">
          Última leitura: {leitura.time.toLocaleString('pt-BR')}
        </span>
      </div>

      {leitura.temperatura_invalida && (
        <div className="alert alert-warning">
          <AlertTriangle size={20} className="shrink-0" />
          <div>
            <p className="font-medium">Sensor de Temperatura Fora de Operação</p>
            <p className="text-sm opacity-90 mt-1">
              O sensor de temperatura está retornando valores inválidos ou fora de seu range operacional (34-80°C).
              A temperatura não é confiável. Verifique o sensor fisicamente.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">RPM</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{leitura.rpm}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container text-primary">
              <RotateCw size={22} />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Temperatura</p>
              <p className="text-3xl font-bold text-on-surface mt-1">
                {leitura.temperatura_c !== null ? `${leitura.temperatura_c}°C` : '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container text-warning">
              <GaugeIcon size={22} />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Bateria</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{fmt(leitura.bateria_v)}V</p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container text-secondary">
              <Zap size={22} />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Combustível</p>
              <p className="text-3xl font-bold text-on-surface mt-1">{leitura.combustivel_pct}%</p>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container text-tertiary">
              <Fuel size={22} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Rede (Concessionária)</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-on-surface-variant">L1</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.rede_volts_l1)}V</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">L2</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.rede_volts_l2)}V</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">L3</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.rede_volts_l3)}V</p>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant text-center mt-3">
            Frequência: {fmt(leitura.rede_freq_hz, 2)} Hz
          </p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Gerador</h3>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div>
              <p className="text-xs text-on-surface-variant">L1</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.gerador_volts_l1)}V</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">L2</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.gerador_volts_l2)}V</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">L3</p>
              <p className="text-lg font-semibold text-on-surface">{fmt(leitura.gerador_volts_l3)}V</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-on-surface-variant">I L1</p>
              <p className="text-sm font-medium text-on-surface">{fmt(leitura.gerador_amps_l1)}A</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">I L2</p>
              <p className="text-sm font-medium text-on-surface">{fmt(leitura.gerador_amps_l2)}A</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">I L3</p>
              <p className="text-sm font-medium text-on-surface">{fmt(leitura.gerador_amps_l3)}A</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-on-surface mb-3">Energia Acumulada</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-on-surface-variant">Ativa</p>
            <p className="text-lg font-semibold text-on-surface">{fmt(leitura.energia_kwh)} kWh</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Reativa</p>
            <p className="text-lg font-semibold text-on-surface">{fmt(leitura.energia_kvarh)} kVArh</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Aparente</p>
            <p className="text-lg font-semibold text-on-surface">{fmt(leitura.energia_kvah)} kVAh</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">Partidas</p>
            <p className="text-lg font-semibold text-on-surface">{leitura.partidas}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
