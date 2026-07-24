import { validateSession } from '@/lib/auth/session';
import { getUserPermissions } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PermissionsProvider } from '@/hooks/use-permissions';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateSession();

  if (!session) {
    redirect('/login');
  }

  const permissions = await getUserPermissions(session.user.id);

  const theme = await db.themeConfig.findFirst();

  return (
    <PermissionsProvider permissions={permissions}>
      <DashboardShell
        user={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          avatarUrl: session.user.avatarUrl,
          isOwner: session.user.isOwner,
        }}
        projectName={theme?.projectName || 'AuthForge'}
        primaryColor={theme?.primaryColor || '#3B82F6'}
        logoDarkUrl={theme?.logoDarkUrl || null}
        logoLightUrl={theme?.logoLightUrl || null}
        faviconUrl={theme?.faviconUrl || null}
      >
        {children}
      </DashboardShell>
    </PermissionsProvider>
  );
}
