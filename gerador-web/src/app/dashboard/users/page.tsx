import { getUsers, getUserStats, getRoles } from '@/actions/users';
import { UsersClient } from '@/components/dashboard/users/users-client';
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export default async function UsersPage() {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'users', 'read'))) {
    redirect('/dashboard?error=access_denied');
  }
  const isOwner = session.user.isOwner || false;

  const [usersRes, stats, roles] = await Promise.all([
    getUsers({ page: 1, limit: 10 }), // Initial load
    getUserStats(),
    getRoles(),
  ]);

  if (
    ('error' in usersRes) ||
    ('error' in stats) ||
    (!Array.isArray(roles) && 'error' in roles)
  ) {
    redirect('/dashboard?error=access_denied');
  }

  const { data: users, total } = usersRes;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Usuários</h1>
          <p className="text-sm text-on-surface-variant mt-1">Gerencie os usuários do sistema</p>
        </div>
      </div>

      <UsersClient 
        initialUsers={users} 
        initialTotal={total}
        initialStats={stats} 
        roles={roles} 
        currentUserIsOwner={isOwner}
      />
    </div>
  );
}
