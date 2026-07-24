import { getAuditLogs } from '@/actions/audit';
import AuditClient from '@/components/dashboard/audit/audit-client';
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Auditoria | AuthForge',
};

export default async function AuditPage() {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'audit', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }

  const logs = await getAuditLogs(500);
  
  if (!Array.isArray(logs) && 'error' in logs) {
    redirect('/dashboard?error=access_denied');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Auditoria do Sistema</h1>
        <p className="text-on-surface-variant mt-1">
          Monitoramento de eventos e ações de usuários. Mostrando os últimos 500 registros.
        </p>
      </div>

      <AuditClient initialLogs={logs} />
    </div>
  );
}
