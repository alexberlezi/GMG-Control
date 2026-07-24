'use server';

import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth/wrapper';
import { logAudit, AuditAction } from '@/lib/audit';
import { encryptEmailConfigData } from '@/lib/auth/secrets-config';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { encrypt } from '@/lib/auth/secrets';
import { getClientIp } from '@/lib/network';
import { invalidateEmailCache } from '@/lib/email/send';

const EmailConfigSchema = z.object({
  provider: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpSecure: z.boolean().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().optional(),
  apiKey: z.string().optional(),
}).strict();

export const getEmailConfig = withAuth(async (session) => {
  const { checkPermission } = await import('@/lib/permissions');
  if (!session.user.isOwner && !checkPermission(session.user.roles, 'settings', 'read')) {
    return null;
  }

  try {
    let config = await db.emailConfig.findFirst();
    if (!config) {
      config = await db.emailConfig.create({
        data: { id: 'default' }
      });
    }

    const maskedConfig = { ...config } as any;
    const secretKeys = ['smtpPass', 'apiKey'];
    for (const key of secretKeys) {
      if (maskedConfig[key]) {
        maskedConfig[key] = '__UNCHANGED_SECRET__';
      }
    }

    return maskedConfig;
  } catch (error) {
    console.error('Error fetching EmailConfig:', error);
    return null;
  }
});

export const updateEmailConfig = withAuth(async (session, data: any) => {
  const { checkPermission } = await import('@/lib/permissions');
  try {
    if (!session.user.isOwner && !checkPermission(session.user.roles, 'settings', 'manage')) {
      return { success: false, error: 'Sem permissão.' };
    }

    const parsed = EmailConfigSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: 'Dados inválidos.' };
    }

    const validData = encryptEmailConfigData(parsed.data as any);

    const config = await db.emailConfig.findFirst();
    if (!config) {
      return { success: false, error: 'Configuração não encontrada.' };
    }

    await db.emailConfig.update({
      where: { id: config.id },
      data: validData
    });

    const headersList = await headers();
    const ip = getClientIp(headersList);
    const ua = headersList.get('user-agent') || 'unknown';

    await logAudit({
      action: AuditAction.EMAIL_CONFIG_UPDATE,
      userId: session.user.id,
      metadata: { config_type: 'email' },
      ipAddress: ip,
      userAgent: ua,
    });

    invalidateEmailCache();

    revalidatePath('/dashboard/settings/email');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating EmailConfig:', error);
    return { success: false, error: 'Erro ao atualizar as configurações de e-mail.' };
  }
});
