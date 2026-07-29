import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { HistoricoOperacaoClient } from '@/components/dashboard/gerador/historico-operacao-client';

export default async function HistoricoOperacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; motivo?: string }>;
}) {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'generator', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }

  const { periodo, motivo } = await searchParams;

  // TODO: When Prisma migration for RegistroOperacao is applied, fetch from database
  // For now, return empty array to allow the build to succeed
  const registros: any[] = [];

  return <HistoricoOperacaoClient registros={registros} periodo={periodo} motivo={motivo} />;
}
