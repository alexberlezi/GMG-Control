'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/auth/wrapper';
import { logAudit, AuditAction } from '@/lib/audit';
import { headers } from 'next/headers';
import { getClientIp } from '@/lib/network';

export type SessionWithUser = {
  id: string;
  userId: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  deviceType: string | null;
  expiresAt: Date;
  createdAt: Date;
  lastActiveAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

export const getActiveSessions = withAuth(async (session): Promise<SessionWithUser[]> => {
  try {
    if (!session.user.isOwner) {
      // In a real system, we might only allow Owners or Admins with specific permissions
      return [];
    }

    const sessions = await db.session.findMany({
      where: {
        expiresAt: { gt: new Date() } // Only active sessions
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { lastActiveAt: 'desc' }
    });

    return sessions as unknown as SessionWithUser[];
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    return [];
  }
});

export const revokeSession = withAuth(async (session, sessionId: string) => {
  try {
    if (!session.user.isOwner) {
      return { success: false, error: 'Sem permissão.' };
    }

    const sessionToRevoke = await db.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (!sessionToRevoke) {
      return { success: false, error: 'Sessão não encontrada.' };
    }

    // We can delete the session or set expiresAt to now. Deleting is standard for explicit revocation.
    await db.session.delete({
      where: { id: sessionId }
    });

    const headersList = await headers();
    const ip = getClientIp(headersList);
    const ua = headersList.get('user-agent') || 'unknown';

    await logAudit({
      action: AuditAction.SESSION_REVOKE,
      userId: session.user.id,
      metadata: { revokedSessionId: sessionId, targetUserId: sessionToRevoke.userId },
      ipAddress: ip,
      userAgent: ua,
    });

    revalidatePath('/dashboard/sessions');
    return { success: true };
  } catch (error: any) {
    console.error('Error revoking session:', error);
    return { success: false, error: 'Erro ao revogar sessão.' };
  }
});

export const revokeAllUserSessions = withAuth(async (session, userId: string) => {
  try {
    if (!session.user.isOwner) {
      return { success: false, error: 'Sem permissão.' };
    }

    await db.session.deleteMany({
      where: { userId }
    });

    const headersList = await headers();
    const ip = getClientIp(headersList);
    const ua = headersList.get('user-agent') || 'unknown';

    await logAudit({
      action: AuditAction.SESSION_REVOKE_ALL,
      userId: session.user.id,
      metadata: { targetUserId: userId },
      ipAddress: ip,
      userAgent: ua,
    });

    revalidatePath('/dashboard/sessions');
    return { success: true };
  } catch (error: any) {
    console.error('Error revoking all user sessions:', error);
    return { success: false, error: 'Erro ao revogar sessões do usuário.' };
  }
});
