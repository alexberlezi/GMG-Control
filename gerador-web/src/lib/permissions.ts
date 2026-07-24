import { db } from '@/lib/db';

type Resource = string;
type Action = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'invite' | '*';

const MANAGE_INCLUDES: Action[] = ['create', 'read', 'update', 'delete'];

export function checkPermission(
  userRoles: { role: { permissions: { permission: { resource: string; action: string } }[] } }[],
  resource: string,
  action: Action
): boolean {
  for (const userRole of userRoles) {
    for (const rp of userRole.role.permissions) {
      const perm = rp.permission;
      if (perm.resource === '*' && perm.action === '*') return true;
      if (perm.resource === '*' && perm.action === 'manage') return true;
      if (perm.resource === '*' && perm.action === action) return true;
      if (perm.resource === resource && perm.action === action) return true;
      if (perm.resource === resource && perm.action === 'manage' && MANAGE_INCLUDES.includes(action as Action)) return true;
      if (perm.resource === resource && perm.action === '*') return true;
    }
  }
  return false;
}

export async function can(
  userId: string,
  resource: Resource,
  action: Action,
): Promise<boolean> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  // Check if user is owner (bypass all permissions)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isOwner: true },
  });

  if (user?.isOwner) return true;

  return checkPermission(userRoles, resource, action);
}

export async function requirePermission(
  userId: string,
  resource: Resource,
  action: Action,
): Promise<void> {
  const allowed = await can(userId, resource, action);
  if (!allowed) {
    const error = new Error('FORBIDDEN') as Error & { code: string };
    error.code = 'FORBIDDEN';
    throw error;
  }
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isOwner: true },
  });

  if (user?.isOwner) return ['*:manage'];

  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const permissions = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      permissions.add(`${rp.permission.resource}:${rp.permission.action}`);
    }
  }

  return Array.from(permissions);
}
