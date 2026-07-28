import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import {
  getUltimaLeitura,
  getHistoricoGerador,
  PERIODOS_VALIDOS,
  type Periodo,
} from '@/lib/gerador-db';
import { GeradorStatusCards } from '@/components/dashboard/gerador/gerador-status-cards';
import { GeradorHistoryChart } from '@/components/dashboard/gerador/gerador-history-chart';
import { PeriodoSelector } from '@/components/dashboard/gerador/periodo-selector';
import { AlertTriangle, ServerCrash } from 'lucide-react';

const PERIODO_PADRAO: Periodo = '24h';

function isPeriodo(value: string | undefined): value is Periodo {
  return !!value && (PERIODOS_VALIDOS as string[]).includes(value);
}

export default async function GeradorPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'generator', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }

  const { periodo: periodoParam } = await searchParams;
  const periodo: Periodo = isPeriodo(periodoParam) ? periodoParam : PERIODO_PADRAO;

  let leitura;
  let historico;
  try {
    [leitura, historico] = await Promise.all([
      getUltimaLeitura(),
      getHistoricoGerador(periodo),
    ]);
  } catch (error) {
    console.error('[GeradorPage] Falha ao consultar banco de telemetria:', error);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Painel do Gerador</h1>
        </div>
        <div className="alert alert-error">
          <ServerCrash size={20} className="shrink-0" />
          <div>
            <p className="font-medium">Não foi possível conectar ao banco de telemetria.</p>
            <p className="text-sm opacity-80 mt-1">
              Verifique se o serviço de coleta e o banco de dados do gerador estão acessíveis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dadoObsoleto = !leitura || (Date.now() - leitura.time.getTime()) > 2 * 60 * 1000;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Painel do Gerador</h1>
        <p className="text-sm text-on-surface-variant">
          Status e histórico recente do gerador Deep Sea 4520 MKII.
        </p>
      </div>

      {dadoObsoleto && (
        <div className="alert alert-warning">
          <AlertTriangle size={20} className="shrink-0" />
          <p>
            {leitura
              ? `Sem dados recentes do gerador — última leitura em ${leitura.time.toLocaleString('pt-BR')}.`
              : 'Nenhuma leitura encontrada no banco de telemetria.'}{' '}
            Verifique a coleta.
          </p>
        </div>
      )}

      {leitura && <GeradorStatusCards leitura={leitura} />}

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-on-surface">Histórico</h2>
          <PeriodoSelector periodoAtual={periodo} />
        </div>
        <GeradorHistoryChart dados={historico} />
      </div>
    </div>
  );
}
