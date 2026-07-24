import { getThemeConfig } from '@/actions/theme-config';
import AppearanceSettingsClient from '@/components/dashboard/settings/appearance-settings-client';
import { validateSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Personalização e Identidade | AuthForge',
};

export default async function AppearanceSettingsPage() {
  const session = await validateSession();
  if (!session || !session.user.isOwner) {
    redirect('/dashboard?error=access_denied');
  }

  const config = await getThemeConfig();

  // Se não existir, passamos valores vazios padrão
  const initialConfig = config || {
    projectName: 'AuthForge',
    companyName: '',
    logoLightUrl: '',
    logoDarkUrl: '',
    faviconUrl: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#22C55E',
    accentColor: '#0EA5E9',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Personalização e Identidade Visual</h1>
        <p className="text-on-surface-variant mt-1">
          Configure a marca da sua empresa. As cores salvas aqui alterarão o visual de todo o sistema instantaneamente.
        </p>
      </div>

      <AppearanceSettingsClient initialConfig={initialConfig} />
    </div>
  );
}
