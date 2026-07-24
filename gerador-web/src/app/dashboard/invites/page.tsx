import { getInvites } from '@/actions/invites';
import { db } from '@/lib/db';
import InvitesClient from '@/components/dashboard/invites/invites-client';
import { validateSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Convites | AuthForge',
};

export default async function InvitesPage() {
  const session = await validateSession();
  if (!session || !(await can(session.user.id, 'invites', 'manage'))) {
    redirect('/dashboard?error=access_denied');
  }

  const invites = await getInvites();
  if (!Array.isArray(invites) && 'error' in invites) {
    redirect('/dashboard?error=access_denied');
  }
  
  const roles = await db.role.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isSystem: true }
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Convites Pendentes</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Gerencie convites de acesso enviados para novos membros da equipe.
          </p>
        </div>
      </div>

      <InvitesClient 
        initialInvites={invites} 
        roles={roles} 
      />
    </div>
  );
}
