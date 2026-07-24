import { getAuthConfig } from '@/actions/auth-config';
import AuthSettingsClient from '@/components/dashboard/settings/auth-settings-client';
import { validateSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Configurações de Autenticação | AuthForge',
};

export default async function AuthSettingsPage() {
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
        <h1 className="text-2xl font-bold text-on-surface">Métodos de Autenticação</h1>
        <p className="text-on-surface-variant mt-1">
          Ative ou desative os provedores e métodos que os usuários poderão utilizar para acessar o sistema.
        </p>
      </div>

      <AuthSettingsClient initialConfig={config} />
    </div>
  );
}
