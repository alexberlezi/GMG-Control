'use server';

import { db } from '@/lib/db';
import { logAudit, AuditAction } from '@/lib/audit';
import { checkPermission } from '@/lib/permissions';
import { headers } from 'next/headers';
import { withPermission } from '@/lib/auth/wrapper';
import { getClientIp } from '@/lib/network';

export interface RoleWithDetails {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: Date;
  _count: {
    users: number;
    permissions: number;
  };
  permissions: {
    permission: {
      id: string;
      resource: string;
      action: string;
    }
  }[];
}

export const getRoles = withPermission('roles:read', async (session) => {
  return db.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      isSystem: true,
      isDefault: true,
      createdAt: true,
      _count: { select: { users: true, permissions: true } },
      permissions: { select: { permission: { select: { id: true, resource: true, action: true } } } }
    },
    orderBy: { createdAt: 'asc' },
  });
});

export const getPermissionsGrouped = withPermission('roles:read', async (session) => {
  const permissions = await db.permission.findMany({
    orderBy: [ { resource: 'asc' }, { action: 'asc' } ]
  });

  const grouped = permissions.reduce((acc, curr) => {
    if (!acc[curr.resource]) {
      acc[curr.resource] = [];
    }
    acc[curr.resource].push(curr);
    return acc;
  }, {} as Record<string, typeof permissions>);

  return grouped;
});

export const createRole = withPermission('roles:manage', async (session, data: { name: string; description?: string; permissionIds: string[] }) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  if (!data.name.trim()) return { success: false, error: 'O nome do grupo é obrigatório.' };

  const existing = await db.role.findUnique({ where: { name: data.name.trim() } });
  if (existing) return { success: false, error: 'Já existe um grupo com este nome.' };

  if (!session.user.isOwner) {
    const targetPermissions = await db.permission.findMany({ where: { id: { in: data.permissionIds } } });
    for (const p of targetPermissions) {
      if (p.resource === '*' && p.action === 'manage') {
        return { success: false, error: 'Apenas proprietários podem atribuir permissões globais.' };
      }
      if (!checkPermission(session.user.roles as any, p.resource, p.action as any)) {
        return { success: false, error: `Você não pode conceder uma permissão que não possui: ${p.resource}:${p.action}` };
      }
    }
  }

  const role = await db.role.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      permissions: {
        create: data.permissionIds.map(id => ({
          permissionId: id,
          assignedBy: session.user.id,
        }))
      }
    }
  });

  await logAudit({
    userId: session.user.id,
    action: AuditAction.ROLE_CREATE,
    metadata: { roleId: role.id, roleName: role.name, permissionsCount: data.permissionIds.length },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true, roleId: role.id };
});

export const updateRole = withPermission('roles:manage', async (session, roleId: string, data: { name: string; description?: string; permissionIds: string[] }) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return { success: false, error: 'Grupo não encontrado.' };

  if (role.isSystem) {
    return { success: false, error: 'Não é possível alterar as configurações ou permissões de um grupo do sistema.' };
  }

  if (!session.user.isOwner) {
    const targetPermissions = await db.permission.findMany({ where: { id: { in: data.permissionIds } } });
    for (const p of targetPermissions) {
      if (p.resource === '*' && p.action === 'manage') {
        return { success: false, error: 'Apenas proprietários podem atribuir permissões globais.' };
      }
      if (!checkPermission(session.user.roles as any, p.resource, p.action as any)) {
        return { success: false, error: `Você não pode conceder uma permissão que não possui: ${p.resource}:${p.action}` };
      }
    }
  }

  if (!role.isSystem && data.name.trim() !== role.name) {
    const existing = await db.role.findUnique({ where: { name: data.name.trim() } });
    if (existing) return { success: false, error: 'Já existe um grupo com este nome.' };
  }

  await db.$transaction([
    db.rolePermission.deleteMany({ where: { roleId } }),
    db.role.update({
      where: { id: roleId },
      data: {
        name: role.isSystem ? role.name : data.name.trim(),
        description: data.description?.trim() || null,
        permissions: {
          create: data.permissionIds.map(id => ({
            permissionId: id,
            assignedBy: session.user.id,
          }))
        }
      }
    })
  ]);

  await logAudit({
    userId: session.user.id,
    action: AuditAction.ROLE_UPDATE,
    metadata: { roleId, roleName: data.name, permissionsCount: data.permissionIds.length },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true };
});

export const deleteRole = withPermission('roles:manage', async (session, roleId: string) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return { success: false, error: 'Grupo não encontrado.' };
  if (role.isSystem) return { success: false, error: 'Não é possível excluir um grupo do sistema.' };

  await db.role.delete({ where: { id: roleId } });

  await logAudit({
    userId: session.user.id,
    action: AuditAction.ROLE_DELETE,
    metadata: { roleId, roleName: role.name },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true };
});

export const setRoleAsDefault = withPermission('roles:manage', async (session, roleId: string) => {
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return { success: false, error: 'Grupo não encontrado.' };
  if (role.isSystem) return { success: false, error: 'Grupos do sistema não podem ser o padrão.' };
  if (role.isDefault) return { success: true };

  await db.$transaction([
    db.role.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    db.role.update({ where: { id: roleId }, data: { isDefault: true } }),
  ]);

  const headersList = await headers();
  await logAudit({
    userId: session.user.id,
    action: AuditAction.ROLE_SET_DEFAULT,
    metadata: { roleId, roleName: role.name },
    ipAddress: getClientIp(headersList),
    userAgent: headersList.get('user-agent') || 'unknown',
  });

  return { success: true };
});

export const getRoleUsers = withPermission('roles:read', async (session, roleId: string) => {
  return db.user.findMany({
    where: { roles: { some: { roleId } } },
    select: { id: true, name: true, email: true, isActive: true },
    orderBy: { name: 'asc' }
  });
});

export const searchUsersNotInRole = withPermission('roles:read', async (session, roleId: string, search: string) => {
  if (!search || search.length < 2) return [];

  return db.user.findMany({
    where: {
      AND: [
        { roles: { none: { roleId } } },
        { OR: [ { name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } } ] }
      ]
    },
    select: { id: true, name: true, email: true },
    take: 10,
    orderBy: { name: 'asc' }
  });
});

export const assignUserToRole = withPermission('roles:manage', async (session, userId: string, roleId: string) => {
  if (userId === session.user.id) {
    return { success: false, error: 'Não é possível atribuir grupos a si mesmo.' };
  }

  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return { success: false, error: 'Grupo não encontrado.' };

  if (role.isSystem && !session.user.isOwner) {
    return { success: false, error: 'Apenas proprietários podem atribuir grupos do sistema.' };
  }

  const existing = await db.userRole.findUnique({
    where: { userId_roleId: { userId, roleId } }
  });
  
  if (existing) return { success: true };

  await db.userRole.create({
    data: { userId, roleId, assignedBy: session.user.id }
  });

  const headersList = await headers();
  await logAudit({
    userId: session.user.id,
    action: AuditAction.USER_UPDATE,
    metadata: { action: 'assign_role', targetUserId: userId, roleId, roleName: role.name },
    ipAddress: getClientIp(headersList),
    userAgent: headersList.get('user-agent') || 'unknown',
  });

  return { success: true };
});

export const removeUserFromRole = withPermission('roles:manage', async (session, userId: string, roleId: string) => {
  const existing = await db.userRole.findUnique({
    where: { userId_roleId: { userId, roleId } }
  });

  if (!existing) return { success: true };

  const role = await db.role.findUnique({ where: { id: roleId } });
  if (role?.isSystem && userId === session.user.id) {
    return { success: false, error: 'Você não pode remover a si mesmo do grupo principal.' };
  }

  await db.userRole.delete({
    where: { userId_roleId: { userId, roleId } }
  });

  const headersList = await headers();
  await logAudit({
    userId: session.user.id,
    action: AuditAction.USER_UPDATE,
    metadata: { action: 'remove_role', targetUserId: userId, roleId, roleName: role?.name },
    ipAddress: getClientIp(headersList),
    userAgent: headersList.get('user-agent') || 'unknown',
  });

  return { success: true };
});
