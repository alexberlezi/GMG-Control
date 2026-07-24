'use server';

import { db } from '@/lib/db';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { logAudit, AuditAction } from '@/lib/audit';
import { headers } from 'next/headers';
import { withAuth, withPermission } from '@/lib/auth/wrapper';
import { createVerificationToken } from '@/lib/auth/tokens';
import { sendEmail } from '@/lib/email/send';
import { escapeHtml } from '@/lib/email/templates';
import { getClientIp } from '@/lib/network';

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  authProvider: string;
  isOwner: boolean;
  isActive: boolean;
  twoFactorEnabled: boolean;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: { role: { name: string } }[];
  _count: { sessions: number };
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  withMfa: number;
  recentlyCreated: number;
}

export const getUsers = withPermission('users:read', async (session, params?: {
  page?: number;
  limit?: number;
  search?: string;
  sortCol?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ data: UserListItem[]; total: number }> => {
  const { page = 1, limit = 10, search = '', sortCol = 'createdAt', sortDir = 'desc' } = params || {};
  
  const where = search ? {
    OR: [
      { name: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ]
  } : {};

  let orderBy: any = {};
  if (sortCol === 'roles' || sortCol === 'sessions') {
    orderBy = { createdAt: sortDir }; 
  } else {
    orderBy = { [sortCol]: sortDir };
  }

  const [data, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        authProvider: true,
        isOwner: true,
        isActive: true,
        twoFactorEnabled: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        roles: { select: { role: { select: { name: true } } } },
        _count: { select: { sessions: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where })
  ]);

  return { data, total };
});

export const getUserStats = withPermission('users:read', async (session): Promise<UserStats> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, active, inactive, withMfa, recentlyCreated] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isActive: true } }),
    db.user.count({ where: { isActive: false } }),
    db.user.count({ where: { twoFactorEnabled: true } }),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  ]);

  return { total, active, inactive, withMfa, recentlyCreated };
});

export const toggleUserStatus = withPermission('users:manage', async (session, userId: string) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'Usuário não encontrado' };
  if (user.isOwner) return { success: false, error: 'Não é possível desativar o proprietário' };

  const updated = await db.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  await logAudit({
    action: updated.isActive ? AuditAction.USER_ACTIVATE : AuditAction.USER_DEACTIVATE,
    userId: session.user.id,
    targetUserId: userId,
    metadata: { email: user.email },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true, isActive: updated.isActive };
});

export const createUser = withPermission('users:manage', async (session, data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  roleId?: string;
}) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  if (!data.name.trim() || !data.email.trim() || !data.password.trim()) {
    return { success: false, error: 'Nome, email e senha são obrigatórios' };
  }

  const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) {
    return { success: false, error: 'Este email já está cadastrado' };
  }

  if (data.roleId) {
    const role = await db.role.findUnique({ where: { id: data.roleId } });
    if (!role) return { success: false, error: 'Grupo não encontrado.' };
    if (role.isSystem && !session.user.isOwner) {
      return { success: false, error: 'Apenas proprietários podem atribuir grupos do sistema (Owner).' };
    }
  }

  const passwordCheck = validatePasswordStrength(data.password);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.errors[0] };
  }

  const passwordHash = await hashPassword(data.password);

  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      phone: data.phone || null,
      emailVerified: new Date(),
      isActive: true,
      roles: data.roleId ? { create: { roleId: data.roleId } } : undefined,
    },
  });

  await logAudit({
    action: AuditAction.USER_CREATE,
    userId: session.user.id,
    targetUserId: user.id,
    metadata: { email: user.email, name: user.name },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true, userId: user.id };
});

export const updateUser = withPermission('users:manage', async (session, userId: string, data: {
  name: string;
  email: string;
  phone?: string;
  roleId?: string;
}) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  if (!data.name.trim() || !data.email.trim()) {
    return { success: false, error: 'Nome e email são obrigatórios' };
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'Usuário não encontrado' };

  if (user.isOwner && !session.user.isOwner) {
    return { success: false, error: 'Apenas o proprietário pode alterar os dados de outro proprietário.' };
  }

  if (data.roleId) {
    const role = await db.role.findUnique({ where: { id: data.roleId } });
    if (!role) return { success: false, error: 'Grupo não encontrado.' };
    if (role.isSystem && !session.user.isOwner) {
      return { success: false, error: 'Apenas proprietários podem atribuir grupos do sistema (Owner).' };
    }
  }

  if (data.email.toLowerCase() !== user.email) {
    const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) return { success: false, error: 'Este email já está cadastrado' };
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
    },
  });

  await db.userRole.deleteMany({ where: { userId } });
  if (data.roleId) {
    await db.userRole.create({ data: { userId, roleId: data.roleId } });
  }

  await logAudit({
    action: AuditAction.USER_UPDATE,
    userId: session.user.id,
    targetUserId: userId,
    metadata: { email: updated.email, name: updated.name },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true };
});

export const resetUserPassword = withPermission('users:manage', async (session, userId: string) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'Usuário não encontrado' };

  const token = await createVerificationToken({ email: user.email, type: 'PASSWORD_RESET', userId: user.id });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'localhost:3000';
  const resetLink = `http${appUrl.includes('localhost') ? '' : 's'}://${appUrl}/auth/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Redefinição de Senha',
    html: `<p>Olá ${escapeHtml(user.name)}, um administrador solicitou a redefinição de sua senha.</p>
           <p>Clique no link abaixo para criar uma nova senha:</p>
           <a href="${resetLink}">Redefinir Senha</a>`
  });

  await logAudit({
    action: AuditAction.PASSWORD_RESET_REQUEST,
    userId: session.user.id,
    targetUserId: userId,
    metadata: { email: user.email, method: 'admin_reset_link' },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true };
});

export const deleteUser = withAuth(async (session, userId: string) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  if (!session?.user.isOwner) {
    return { success: false, error: 'Acesso negado. Apenas o proprietário pode excluir usuários.' };
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'Usuário não encontrado' };
  if (user.isOwner) return { success: false, error: 'Não é possível excluir um proprietário (Owner).' };

  await db.user.delete({ where: { id: userId } });

  await logAudit({
    action: AuditAction.USER_DELETE,
    userId: session.user.id,
    targetUserId: userId,
    metadata: { email: user.email, name: user.name },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true };
});

export const revokeUserSessions = withPermission('users:manage', async (session, userId: string) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'Usuário não encontrado' };

  const { count } = await db.session.deleteMany({ where: { userId } });

  await logAudit({
    action: AuditAction.SESSION_REVOKE_ALL,
    userId: session.user.id,
    targetUserId: userId,
    metadata: { email: user.email, revokedCount: count },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true, count };
});

export const getRoles = withPermission('users:read', async (session) => {
  return db.role.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { name: 'asc' },
  });
});
