'use server';

import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth/wrapper';
import { revalidatePath } from 'next/cache';

export const getUnreadNotificationsAction = withAuth(async (session) => {
  try {
    const notifications = await db.notification.findMany({
      where: { userId: session.user.id, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return { success: true, notifications };
  } catch (error) {
    return { success: false, error: 'Erro ao buscar notificações' };
  }
});

export const markAsReadAction = withAuth(async (session, notificationId: string) => {
  try {
    await db.notification.update({
      where: { id: notificationId, userId: session.user.id },
      data: { isRead: true }
    });
    
    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao marcar como lida' };
  }
});

export const markAllAsReadAction = withAuth(async (session) => {
  try {
    await db.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true }
    });

    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Erro ao marcar todas como lidas' };
  }
});
