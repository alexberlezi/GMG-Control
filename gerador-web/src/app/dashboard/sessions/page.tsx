import { getActiveSessions } from '@/actions/sessions';
import SessionsClient from '@/components/dashboard/sessions/sessions-client';
import { validateSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Sessões Ativas | AuthForge',
};

export default async function SessionsPage() {
  const session = await validateSession();
  if (!session || !session.user.isOwner) {
    redirect('/dashboard?error=access_denied');
  }

  const sessions = await getActiveSessions();
  if (!Array.isArray(sessions) && 'error' in sessions) {
    redirect('/dashboard?error=access_denied');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Sessões Ativas</h1>
        <p className="text-on-surface-variant mt-1">
          Monitoramento e revogação de dispositivos conectados.
        </p>
      </div>

      <SessionsClient initialSessions={sessions} />
    </div>
  );
}
