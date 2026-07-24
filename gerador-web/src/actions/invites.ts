'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/email';
import { withPermission } from '@/lib/auth/wrapper';
import { randomUUID } from 'crypto';

export type InviteWithDetails = {
  id: string;
  email: string;
  roleId: string;
  invitedBy: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  token: string;
  expiresAt: Date;
  createdAt: Date;
  role: { name: string; id: string };
  inviter?: { name: string | null };
};

export const getInvites = withPermission('users:read', async (session): Promise<InviteWithDetails[]> => {
  try {
    const invites = await db.invite.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        role: { select: { name: true, id: true } }
      }
    });

    const userIds = [...new Set(invites.map(i => i.invitedBy).filter((id): id is string => id !== null))];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true }
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    return invites.map(invite => ({
      ...invite,
      inviter: (invite.invitedBy ? userMap.get(invite.invitedBy) : undefined) || { name: 'Desconhecido' }
    })) as InviteWithDetails[];
  } catch (error) {
    console.error('Error fetching invites:', error);
    return [];
  }
});

export const createInvite = withPermission('users:manage', async (session, email: string, roleId: string) => {
  try {
    const userId = session.user.id;

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return { success: false, error: 'Já existe um usuário cadastrado com este e-mail.' };
    }

    const existingInvite = await db.invite.findFirst({
      where: { email, status: 'PENDING' }
    });
    if (existingInvite) {
      return { success: false, error: 'Já existe um convite pendente para este e-mail.' };
    }

    const role = await db.role.findUnique({ where: { id: roleId } });
    if (!role) return { success: false, error: 'Grupo não encontrado.' };

    // PREVENIR ESCALAÇÃO DE PRIVILÉGIOS
    if (role.isSystem && !session.user.isOwner) {
      return { success: false, error: 'Apenas proprietários podem convidar usuários para grupos do sistema (Owner).' };
    }

    const inviteToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    const invite = await db.invite.create({
      data: {
        email,
        roleId,
        invitedBy: userId,
        token: inviteToken,
        expiresAt,
        status: 'PENDING'
      }
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const inviteLink = `http${appUrl.includes('localhost') ? '' : 's'}://${appUrl}/invite/${inviteToken}`;

    const html = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
        <h2>Você foi convidado!</h2>
        <p>Você recebeu um convite para ingressar como <strong>${role.name}</strong>.</p>
        <p>Clique no botão abaixo para criar sua conta:</p>
        <div style="margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Aceitar Convite</a>
        </div>
        <p style="color: #666; font-size: 12px;">Se o botão não funcionar, copie e cole este link no navegador: ${inviteLink}</p>
        <p style="color: #666; font-size: 12px;">Este convite expira em 7 dias.</p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: 'Convite para criar sua conta',
      html
    });

    revalidatePath('/dashboard/invites');
    return { success: true, id: invite.id };
  } catch (error: any) {
    console.error('Error creating invite:', error);
    return { success: false, error: error.message || 'Erro ao criar convite.' };
  }
});

export const cancelInvite = withPermission('users:manage', async (session, id: string) => {
  try {
    await db.invite.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });
    revalidatePath('/dashboard/invites');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

export const resendInvite = withPermission('users:manage', async (session, id: string) => {
  try {
    const invite = await db.invite.findUnique({
      where: { id },
      include: { role: true }
    });

    if (!invite || invite.status !== 'PENDING') {
      return { success: false, error: 'Convite não encontrado ou não está mais pendente.' };
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const inviteLink = `http${appUrl.includes('localhost') ? '' : 's'}://${appUrl}/invite/${invite.token}`;

    const html = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
        <h2>Lembrete de Convite</h2>
        <p>Você tem um convite pendente para ingressar como <strong>${invite.role.name}</strong>.</p>
        <p>Clique no botão abaixo para criar sua conta:</p>
        <div style="margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Aceitar Convite</a>
        </div>
      </div>
    `;

    await sendEmail({
      to: invite.email,
      subject: 'Lembrete: Convite pendente',
      html
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await db.invite.update({
      where: { id },
      data: { expiresAt }
    });

    revalidatePath('/dashboard/invites');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
