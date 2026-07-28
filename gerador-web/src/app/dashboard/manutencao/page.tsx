import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { getManutencoes } from '@/actions/manutencao';
import { ManutencaoClient } from '@/components/dashboard/manutencao/manutencao-client';

export default async function ManutencaoPage() {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'generator', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }

  const registros = await getManutencoes();

  if (!Array.isArray(registros)) {
    redirect('/dashboard?error=access_denied');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Manutenções do Gerador</h1>
        <p className="text-sm text-on-surface-variant">
          Abastecimento, troca de óleo, aditivo, bateria, limpeza e registro de defeitos/avarias.
        </p>
      </div>
      <ManutencaoClient initialRegistros={registros} />
    </div>
  );
}
