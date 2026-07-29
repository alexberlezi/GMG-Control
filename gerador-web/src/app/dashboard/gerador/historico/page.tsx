import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { HistoricoOperacaoClient } from '@/components/dashboard/gerador/historico-operacao-client';
import type { MotivoOperacao } from '@prisma/client';

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; motivo?: string }>;
}) {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'generator', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }

  const { periodo, motivo } = await searchParams;

  let dataInicio = new Date();

  switch (periodo) {
    case 'hoje':
      dataInicio.setHours(0, 0, 0, 0);
      break;
    case 'semana':
      dataInicio.setDate(dataInicio.getDate() - 7);
      break;
    case 'mes':
      dataInicio.setMonth(dataInicio.getMonth() - 1);
      break;
    default:
      dataInicio.setDate(dataInicio.getDate() - 30); // padrão: últimos 30 dias
  }

  const registros = await db.registroOperacao.findMany({
    where: {
      dataHoraInicio: { gte: dataInicio },
      ...(motivo && { motivo: motivo as MotivoOperacao }),
    },
    include: { usuario: { select: { name: true } } },
    orderBy: { dataHoraInicio: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Histórico de Operação</h1>
        <p className="text-sm text-on-surface-variant">
          Registros de cada ciclo de operação do gerador
        </p>
      </div>

      <HistoricoOperacaoClient registros={registros} periodo={periodo} />
    </div>
  );
}
