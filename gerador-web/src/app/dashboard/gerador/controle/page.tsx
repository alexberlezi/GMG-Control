import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { getUltimaLeitura } from '@/lib/gerador-db';
import { ControleGeradorClient } from '@/components/dashboard/gerador/controle-gerador-client';

export default async function ControleGeradorPage() {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'generator', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }

  let leitura: Awaited<ReturnType<typeof getUltimaLeitura>> = null;
  try {
    leitura = await getUltimaLeitura();
  } catch (error) {
    console.error('[ControleGeradorPage] Falha ao consultar banco de telemetria:', error);
  }

  const isLigado = leitura ? leitura.motor_status === 'Rodando' : undefined;

  return <ControleGeradorClient isLigado={isLigado} leitura={leitura} />;
}
