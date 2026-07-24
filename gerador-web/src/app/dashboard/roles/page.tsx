import { getRoles, getPermissionsGrouped } from '@/actions/roles';
import { RolesClient } from '@/components/dashboard/roles/roles-client';
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export default async function RolesPage() {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'roles', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }
  const isOwner = session.user.isOwner || false;

  const [roles, permissionsGrouped] = await Promise.all([
    getRoles(),
    getPermissionsGrouped(),
  ]);

  if ((!Array.isArray(roles) && 'error' in roles) || ('error' in permissionsGrouped)) {
    redirect('/dashboard?error=access_denied');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Grupos de Acesso</h1>
          <p className="text-sm text-on-surface-variant mt-1">Gerencie os perfis de permissão do sistema</p>
        </div>
      </div>

      <RolesClient 
        initialRoles={roles} 
        permissionsGrouped={permissionsGrouped}
        currentUserIsOwner={isOwner}
      />
    </div>
  );
}
