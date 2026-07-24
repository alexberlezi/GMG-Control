import { validateSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/dashboard/profile/profile-form';
import { SecurityForm } from '@/components/dashboard/profile/security-form';
import { SessionsList } from '@/components/dashboard/profile/sessions-list';
import { getThemeConfig } from '@/actions/theme-config';

export const metadata = {
  title: 'Meu Perfil | Painel',
};

export default async function ProfilePage() {
  const sessionData = await validateSession();
  
  if (!sessionData) {
    redirect('/login');
  }

  // Busca dados mais recentes do usuário
  const user = await db.user.findUnique({
    where: { id: sessionData.user.id }
  });

  if (!user) {
    redirect('/login');
  }

  // Busca as sessões
  const rawSessions = await db.session.findMany({
    where: { userId: user.id },
    orderBy: { lastActiveAt: 'desc' }
  });

  const sessions = rawSessions.map(s => ({
    id: s.id,
    ipAddress: s.ipAddress,
    userAgent: s.userAgent,
    lastActiveAt: s.lastActiveAt,
    isCurrent: s.id === sessionData.id
  }));

  const theme = await getThemeConfig();
  if (!theme || 'error' in theme) {
    import('next/navigation').then(m => m.redirect('/dashboard?error=access_denied'));
    return null;
  }

  return (
    <div className="w-full space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface">Meu Perfil</h1>
        <p className="text-sm text-on-surface-variant mt-1">Gerencie suas informações pessoais e configurações de segurança.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Principal (Dados e Sessões) */}
        <div className="lg:col-span-2 space-y-6">
          <ProfileForm 
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
            }}
            primaryColor={theme.primaryColor}
            authProvider={user.authProvider}
          />

          <SessionsList sessions={sessions} />
        </div>

        {/* Coluna Lateral (Segurança) */}
        <div className="space-y-6">
          <SecurityForm twoFactorEnabled={user.twoFactorEnabled} authProvider={user.authProvider} />
        </div>

      </div>
    </div>
  );
}
