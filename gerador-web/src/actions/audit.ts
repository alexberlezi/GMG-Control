'use server';

import { db } from '@/lib/db';
import { withPermission } from '@/lib/auth/wrapper';

export type AuditLogWithUser = {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

export const getAuditLogs = withPermission('audit:read', async (session, limit = 500): Promise<AuditLogWithUser[]> => {
  try {

    const logs = await db.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return logs as unknown as AuditLogWithUser[];
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
});
