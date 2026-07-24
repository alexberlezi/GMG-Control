import { getAuthConfig } from '@/actions/auth-config';
import SecuritySettingsClient from '@/components/dashboard/settings/security-settings-client';
import { validateSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Políticas de Segurança | AuthForge',
};

export default async function SecuritySettingsPage() {
  const session = await validateSession();
  if (!session || !session.user.isOwner) {
    redirect('/dashboard?error=access_denied');
  }

  const config = await getAuthConfig();

  if (!config) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Políticas de Segurança</h1>
        <p className="text-on-surface-variant mt-1">
          Defina as regras globais de senhas, proteção contra força bruta e tempo de sessão para todos os usuários.
        </p>
      </div>

      <SecuritySettingsClient initialConfig={config} />
    </div>
  );
}
