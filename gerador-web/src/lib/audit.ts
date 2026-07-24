import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { resolveIpToLocation } from './auth/geoip';

export async function logAudit(params: {
  userId?: string;
  targetUserId?: string;
  action: string;
  resource?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    let location: string | undefined;
    if (params.ipAddress) {
      const loc = await resolveIpToLocation(params.ipAddress);
      if (loc) location = loc;
    }

    await db.auditLog.create({
      data: {
        action: params.action,
        resource: params.resource,
        metadata: {
          ...params.metadata,
          ...(params.targetUserId ? { targetUserId: params.targetUserId } : {})
        } as Prisma.InputJsonValue | undefined,
        ipAddress: params.ipAddress,
        location,
        userAgent: params.userAgent,
        userId: params.userId ?? null,
      },
    });
  } catch (error) {
    console.error('[Audit] Failed to log audit event:', error);
  }
}

// Common audit actions
export const AuditAction = {
  // Auth
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',
  PASSWORD_RESET_REQUEST: 'auth.password_reset.request',
  PASSWORD_RESET_COMPLETE: 'auth.password_reset.complete',
  PASSWORD_CHANGE: 'auth.password_change',
  MAGIC_LINK_REQUEST: 'auth.magic_link.request',
  MAGIC_LINK_VERIFY: 'auth.magic_link.verify',
  OTP_REQUEST: 'auth.otp.request',
  OTP_VERIFY: 'auth.otp.verify',
  OAUTH_LOGIN: 'auth.oauth.login',
  OAUTH_LINK: 'auth.oauth.link',
  TWO_FACTOR_ENABLE: 'auth.2fa.enable',
  TWO_FACTOR_DISABLE: 'auth.2fa.disable',
  TWO_FACTOR_VERIFY: 'auth.2fa.verify',
  ACCOUNT_LOCKED: 'auth.account.locked',

  // Users
  USER_CREATE: 'users.create',
  USER_UPDATE: 'users.update',
  USER_DEACTIVATE: 'users.deactivate',
  USER_ACTIVATE: 'users.activate',
  USER_DELETE: 'users.delete',
  USER_AUTO_PROVISIONED: 'users.auto_provisioned',

  // Roles
  ROLE_CREATE: 'roles.create',
  ROLE_UPDATE: 'roles.update',
  ROLE_DELETE: 'roles.delete',
  ROLE_SET_DEFAULT: 'roles.set_default',

  // Sessions
  SESSION_REVOKE: 'sessions.revoke',
  SESSION_REVOKE_ALL: 'sessions.revoke_all',

  // Invites
  INVITE_SEND: 'invites.send',
  INVITE_ACCEPT: 'invites.accept',
  INVITE_CANCEL: 'invites.cancel',

  // Settings
  SETTINGS_UPDATE: 'settings.update',
  AUTH_CONFIG_UPDATE: 'settings.auth_config.update',
  EMAIL_CONFIG_UPDATE: 'settings.email_config.update',
  THEME_UPDATE: 'settings.theme.update',
  LDAP_CONFIG_UPDATE: 'settings.ldap_config.update',

  // System
  SETUP_COMPLETE: 'system.setup.complete',
  TEST_EMAIL_SENT: 'system.test_email.sent',
} as const;
