import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { getUltimaLeitura } from '@/lib/gerador-db';
import { ControleGeradorClient } from '@/components/dashboard/gerador/controle-gerador-client';

export default async function ControleGeradorPage() {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'generator', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }

  const leitura = await getUltimaLeitura();
  const estaLigado = leitura?.motor_status === 'Rodando';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Controle do Gerador</h1>
        <p className="text-sm text-on-surface-variant">
          Ligar/desligar e programar ciclos de operação
        </p>
      </div>

      <ControleGeradorClient leitura={leitura} estaLigado={estaLigado} />
    </div>
  );
}
