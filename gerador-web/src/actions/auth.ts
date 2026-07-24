'use server';

import { db } from '@/lib/db';
import { verifyPassword, hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { rateLimitByIP, rateLimitByEmail, rateLimitByAction } from '@/lib/auth/rate-limit';
import argon2 from 'argon2';
import { verifyTurnstileToken, getTurnstileConfig } from '@/lib/auth/turnstile';
import { logAudit, AuditAction } from '@/lib/audit';
import { headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import * as OTPAuth from 'otpauth';
import { decrypt } from '@/lib/auth/secrets';
import { createHash } from 'crypto';
import { authenticateWithLdap, getLdapConfig } from '@/lib/auth/ldap';
import { getSecret } from '@/lib/auth/tokens';
import { getClientIp } from '@/lib/network';

export async function loginAction(formData: {
  email: string;
  password: string;
  turnstileToken?: string;
  isLdap?: boolean;
}) {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  // Rate limit by IP
  const ipCheck = await rateLimitByIP(ip, 20, 60000);
  if (!ipCheck.allowed) {
    return { success: false, error: 'Muitas tentativas. Aguarde um momento.' };
  }

  // Rate limit by email
  const emailCheck = await rateLimitByEmail(formData.email, 5, 900000);
  if (!emailCheck.allowed) {
    return { success: false, error: 'Muitas tentativas para este email. Aguarde 15 minutos.' };
  }

  // Turnstile check (ADR-002)
  const turnstileConfig = await getTurnstileConfig();
  if (turnstileConfig.enabled) {
    const turnstileResult = await verifyTurnstileToken(
      formData.turnstileToken,
      turnstileConfig.secretKey,
    );
    if (!turnstileResult.success) {
      await logLoginAttempt(formData.email, null, false, ip, ua, 'turnstile_failed');
      return { success: false, error: turnstileResult.error };
    }
  }

  // ═══════════════════════════════════════
  // LDAP AUTHENTICATION FLOW
  // ═══════════════════════════════════════
  if (formData.isLdap) {
    const ldapConfig = await getLdapConfig();
    if (!ldapConfig) {
      return { success: false, error: 'LDAP não está configurado ou habilitado.' };
    }

    const ldapResult = await authenticateWithLdap(ldapConfig, formData.email, formData.password);

    if (!ldapResult.success || !ldapResult.user) {
      // Fallback to local auth if enabled
      const authConfig = await db.authConfig.findFirst();
      if (authConfig?.ldapFallbackToLocal) {
        return await localLogin(formData.email, formData.password, ip, ua);
      }

      await logLoginAttempt(formData.email, null, false, ip, ua, 'ldap_failed');
      await logAudit({
        action: AuditAction.LOGIN_FAILED,
        metadata: { email: formData.email, reason: 'ldap_auth_failed', method: 'ldap' },
        ipAddress: ip, userAgent: ua,
      });
      return { success: false, error: ldapResult.error || 'Falha na autenticação LDAP.' };
    }

    // LDAP auth succeeded — find or create user
    const ldapUser = ldapResult.user;
    let user = await db.user.findFirst({
      where: {
        OR: [
          { ldapDn: ldapUser.dn },
          { email: ldapUser.email },
        ],
      },
    });

    if (user && !user.isActive) {
      await logLoginAttempt(ldapUser.email, user.id, false, ip, ua, 'locked');
      return { success: false, error: 'Conta desativada. Contate o administrador.' };
    }

    if (!user) {
      // Auto-provision: create user with default role
      const defaultRole = await db.role.findFirst({ where: { isDefault: true } });

      user = await db.user.create({
        data: {
          name: ldapUser.displayName,
          firstName: ldapUser.firstName || null,
          lastName: ldapUser.lastName || null,
          email: ldapUser.email,
          authProvider: 'ldap',
          ldapDn: ldapUser.dn,
          passwordHash: null,
          emailVerified: new Date(),
          ...(defaultRole ? { roles: { create: { roleId: defaultRole.id } } } : {}),
        },
      });

      await logAudit({
        userId: user.id,
        action: 'user.auto_provisioned',
        metadata: { method: 'ldap', dn: ldapUser.dn, email: ldapUser.email },
        ipAddress: ip, userAgent: ua,
      });
    } else {
      // Update user info from LDAP if changed
      const updates: any = {};
      if (user.name !== ldapUser.displayName) updates.name = ldapUser.displayName;
      if (user.ldapDn !== ldapUser.dn) updates.ldapDn = ldapUser.dn;
      if (user.authProvider !== 'ldap') updates.authProvider = 'ldap';
      if (ldapUser.firstName && user.firstName !== ldapUser.firstName) updates.firstName = ldapUser.firstName;
      if (ldapUser.lastName && user.lastName !== ldapUser.lastName) updates.lastName = ldapUser.lastName;

      if (Object.keys(updates).length > 0) {
        await db.user.update({ where: { id: user.id }, data: updates });
      }
    }

    // Check 2FA for LDAP user
    if (user.twoFactorEnabled) {
      const jwtSecret = getSecret();
      const preAuthToken = await new SignJWT({ userId: user.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('5m')
        .sign(jwtSecret);
      return { success: true, requires2FA: true, preAuthToken };
    }

    // Create session
    await createSession({ userId: user.id, ipAddress: ip, userAgent: ua });
    await logLoginAttempt(ldapUser.email, user.id, true, ip, ua);

    await logAudit({
      userId: user.id, action: AuditAction.LOGIN_SUCCESS,
      metadata: { method: 'ldap', dn: ldapUser.dn }, ipAddress: ip, userAgent: ua,
    });

    return { success: true, redirectTo: '/dashboard' };
  }

  // ═══════════════════════════════════════
  // LOCAL (PASSWORD) AUTHENTICATION FLOW
  // ═══════════════════════════════════════
  return await localLogin(formData.email, formData.password, ip, ua);
}

async function localLogin(email: string, password: string, ip: string, ua: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  const genericError = 'Email ou senha incorretos.';

  if (!user || !user.passwordHash) {
    await logLoginAttempt(email, null, false, ip, ua, 'invalid_credentials');
    await logAudit({ action: AuditAction.LOGIN_FAILED, metadata: { email, reason: 'user_not_found' }, ipAddress: ip, userAgent: ua });
    return { success: false, error: genericError };
  }

  if (!user.isActive) {
    await logLoginAttempt(email, user.id, false, ip, ua, 'locked');
    return { success: false, error: 'Conta desativada. Contate o administrador.' };
  }

  // Check lockout
  const authConfig = await db.authConfig.findFirst();
  const maxAttempts = authConfig?.maxLoginAttempts || 5;
  const lockoutDuration = (authConfig?.lockoutDuration || 900) * 1000;

  const recentFailedAttempts = await db.loginAttempt.count({
    where: {
      email: email.toLowerCase(),
      success: false,
      createdAt: { gt: new Date(Date.now() - lockoutDuration) },
    },
  });

  if (recentFailedAttempts >= maxAttempts) {
    await logAudit({
      userId: user.id,
      action: AuditAction.ACCOUNT_LOCKED,
      metadata: { email, attempts: recentFailedAttempts },
      ipAddress: ip, userAgent: ua,
    });
    return { success: false, error: 'Conta temporariamente bloqueada. Aguarde 15 minutos.' };
  }

  const validPassword = await verifyPassword(user.passwordHash, password);

  if (!validPassword) {
    await logLoginAttempt(email, user.id, false, ip, ua, 'invalid_password');
    await logAudit({
      userId: user.id, action: AuditAction.LOGIN_FAILED,
      metadata: { reason: 'invalid_password' }, ipAddress: ip, userAgent: ua,
    });
    return { success: false, error: genericError };
  }

  // Check 2FA
  if (user.twoFactorEnabled) {
    const jwtSecret = getSecret();
    const preAuthToken = await new SignJWT({ userId: user.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('5m')
      .sign(jwtSecret);
    return { success: true, requires2FA: true, preAuthToken };
  }

  // Check force password change
  if (user.mustChangePassword) {
    await createSession({ userId: user.id, ipAddress: ip, userAgent: ua });
    await logLoginAttempt(email, user.id, true, ip, ua);
    return { success: true, redirectTo: '/dashboard/profile' };
  }

  // Create session
  await createSession({ userId: user.id, ipAddress: ip, userAgent: ua });
  await logLoginAttempt(email, user.id, true, ip, ua);

  await logAudit({
    userId: user.id, action: AuditAction.LOGIN_SUCCESS,
    metadata: { method: 'password' }, ipAddress: ip, userAgent: ua,
  });

  return { success: true, redirectTo: '/dashboard' };
}

async function logLoginAttempt(
  email: string,
  userId: string | null,
  success: boolean,
  ipAddress: string,
  userAgent: string,
  failReason?: string,
) {
  await db.loginAttempt.create({
    data: {
      email: email.toLowerCase(),
      userId,
      method: 'password',
      success,
      ipAddress,
      userAgent,
      failReason: success ? undefined : failReason,
    },
  });
}

import { consumeTotp } from '@/lib/auth/totp';

export async function verify2FALogin(preAuthToken: string | undefined, code: string) {
  const reqHeaders = await headers();
  const ip = getClientIp(reqHeaders);
  const ua = reqHeaders.get('user-agent') || 'unknown';

  let token = preAuthToken;
  if (!token) {
    const cookieStore = await (await import('next/headers')).cookies();
    token = cookieStore.get('preAuthToken')?.value;
  }

  if (!token) {
    return { success: false, error: 'Sessão expirou. Tente logar novamente.' };
  }

  try {
    const jwtSecret = getSecret();
    const { payload } = await jwtVerify(token, jwtSecret);
    const userId = payload.userId as string;

    const user = await db.user.findUnique({ 
      where: { id: userId },
      include: { backupCodes: true }
    });
    
    if (!user || !user.twoFactorSecret) {
      return { success: false, error: 'Usuário não encontrado ou 2FA não configurado' };
    }

    const rateLimit = await rateLimitByAction('2fa', userId, 5, 900000);
    if (!rateLimit.allowed) {
      await logLoginAttempt(user.email, user.id, false, ip, ua, 'rate_limited');
      return { success: false, error: 'Muitas tentativas. Tente novamente mais tarde.' };
    }

    const secret = decrypt(user.twoFactorSecret);
    let isValid = false;

    // Check if it's a TOTP code
    isValid = await consumeTotp(user.id, secret, code);

    // Check if it's a backup code
    if (!isValid && code.includes('-')) {
      const [prefix, bcSecret] = code.split('-');
      if (prefix && bcSecret) {
        // Must include usedAt: null to prevent reuse of consumed backup codes
        const backupCode = await db.backupCode.findFirst({
          where: { userId: user.id, prefix, usedAt: null }
        });
        
        if (backupCode) {
          const isValidBC = await argon2.verify(backupCode.codeHash, bcSecret);
          if (isValidBC) {
            // Atomic update to prevent race conditions
            const updateResult = await db.backupCode.updateMany({
              where: { id: backupCode.id, usedAt: null },
              data: { usedAt: new Date() }
            });
            if (updateResult.count > 0) {
              isValid = true;
            }
          }
        }
      }
    }

    if (!isValid) {
      await logLoginAttempt(user.email, user.id, false, ip, ua, 'invalid_2fa');
      await logAudit({
        userId: user.id, action: AuditAction.LOGIN_FAILED,
        metadata: { reason: 'invalid_2fa' }, ipAddress: ip, userAgent: ua,
      });
      return { success: false, error: 'Código 2FA ou Backup inválido' };
    }

    // Check force password change
    if (user.mustChangePassword) {
      await createSession({ userId: user.id, ipAddress: ip, userAgent: ua });
      await logLoginAttempt(user.email, user.id, true, ip, ua);
      return { success: true, redirectTo: '/dashboard/profile' };
    }

    // Success 
    const cookieStore = await (await import('next/headers')).cookies();
    cookieStore.delete('preAuthToken');

    await createSession({ userId: user.id, ipAddress: ip, userAgent: ua });
    await logLoginAttempt(user.email, user.id, true, ip, ua);
    
    await logAudit({
      userId: user.id, action: AuditAction.LOGIN_SUCCESS,
      metadata: { method: 'password+2fa' }, ipAddress: ip, userAgent: ua,
    });

    return { success: true, redirectTo: '/dashboard' };
  } catch (error) {
    console.error('PreAuth token expired or invalid:', error);
    return { success: false, error: 'Sessão expirou. Tente logar novamente.' };
  }
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  try {
    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      return { success: false, error: passwordCheck.errors.join(', ') };
    }

    const verification = await db.verificationToken.findUnique({ where: { token } });
    if (!verification || verification.type !== 'PASSWORD_RESET') {
      return { success: false, error: 'Token inválido' };
    }
    
    if (verification.expiresAt < new Date()) {
      return { success: false, error: 'Token expirado' };
    }

    const user = await db.user.findUnique({ where: { email: verification.email } });
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    const passwordHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    await db.verificationToken.delete({ where: { token } });

    // Revoke all existing sessions globally
    await db.session.deleteMany({
      where: { userId: user.id }
    });

    const reqHeaders = await headers();
    const ip = getClientIp(reqHeaders);
    const ua = reqHeaders.get('user-agent') || 'unknown';

    await logAudit({
      userId: user.id,
      action: AuditAction.PASSWORD_CHANGE,
      metadata: { method: 'token_reset' },
      ipAddress: ip,
      userAgent: ua,
    });

    return { success: true };
  } catch (error) {
    console.error('Error resetting password:', error);
    return { success: false, error: 'Ocorreu um erro ao redefinir a senha.' };
  }
}
