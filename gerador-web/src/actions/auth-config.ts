'use server';

import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth/wrapper';
import { logAudit, AuditAction } from '@/lib/audit';
import { encryptAuthConfigData } from '@/lib/auth/secrets-config';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { encrypt } from '@/lib/auth/secrets';
import { getClientIp } from '@/lib/network';

const AuthConfigSchema = z.object({
  emailPasswordEnabled: z.boolean().optional(),
  magicLinkEnabled: z.boolean().optional(),
  otpEnabled: z.boolean().optional(),
  twoFactorRequired: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),

  googleEnabled: z.boolean().optional(),
  googleClientId: z.string().nullable().optional(),
  googleClientSecret: z.string().nullable().optional(),
  githubEnabled: z.boolean().optional(),
  githubClientId: z.string().nullable().optional(),
  githubClientSecret: z.string().nullable().optional(),
  microsoftEnabled: z.boolean().optional(),
  microsoftClientId: z.string().nullable().optional(),
  microsoftClientSecret: z.string().nullable().optional(),
  facebookEnabled: z.boolean().optional(),
  facebookClientId: z.string().nullable().optional(),
  facebookClientSecret: z.string().nullable().optional(),

  sessionMaxAge: z.number().int().min(3600).optional(),
  maxLoginAttempts: z.number().int().min(1).optional(),
  lockoutDuration: z.number().int().min(60).optional(),
  passwordMinLength: z.number().int().min(6).optional(),
  requireUppercase: z.boolean().optional(),
  requireNumber: z.boolean().optional(),
  requireSpecialChar: z.boolean().optional(),
  passwordExpirationEnabled: z.boolean().optional(),
  passwordExpirationDays: z.number().int().min(1).optional(),

  turnstileEnabled: z.boolean().optional(),
  turnstileSiteKey: z.string().nullable().optional(),
  turnstileSecretKey: z.string().nullable().optional(),
}).strict();

export const getAuthConfig = withAuth(async (session) => {
  const { checkPermission } = await import('@/lib/permissions');
  if (!session.user.isOwner && !checkPermission(session.user.roles, 'settings', 'read')) {
    return null;
  }

  try {
    let config = await db.authConfig.findFirst();
    if (!config) {
      config = await db.authConfig.create({
        data: { id: 'default' }
      });
    }

    const maskedConfig = { ...config } as any;
    const secretKeys = ['googleClientSecret', 'githubClientSecret', 'microsoftClientSecret', 'facebookClientSecret', 'turnstileSecretKey', 'ldapBindPassword'];
    for (const key of secretKeys) {
      if (maskedConfig[key]) {
        maskedConfig[key] = '__UNCHANGED_SECRET__';
      }
    }

    return maskedConfig;
  } catch (error) {
    console.error('Error fetching AuthConfig:', error);
    return null;
  }
});

export const updateAuthConfig = withAuth(async (session, data: any) => {
  try {
    if (!session.user.isOwner) {
      return { success: false, error: 'Sem permissão.' };
    }

    const parsed = AuthConfigSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: 'Dados inválidos.' };
    }

    // encrypt sensitive fields
    const validData = encryptAuthConfigData(parsed.data as any);

    const currentConfig = await db.authConfig.findFirst();

    if (!currentConfig) {
      await db.authConfig.create({
        data: { ...validData, id: 'default' },
      });
    } else {
      await db.authConfig.update({
        where: { id: currentConfig.id },
        data: validData,
      });
    }

    const headersList = await headers();
    const ip = getClientIp(headersList);
    const ua = headersList.get('user-agent') || 'unknown';

    await logAudit({
      action: AuditAction.AUTH_CONFIG_UPDATE,
      userId: session.user.id,
      metadata: { fields_updated: Object.keys(data) },
      ipAddress: ip,
      userAgent: ua,
    });

    revalidatePath('/dashboard/settings/auth');
    revalidatePath('/login');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating AuthConfig:', error);
    return { success: false, error: 'Erro ao atualizar as configurações.' };
  }
});
