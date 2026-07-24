'use server';

import { db } from '@/lib/db';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { logAudit, AuditAction } from '@/lib/audit';
import { encryptAuthConfigData, encryptEmailConfigData } from '@/lib/auth/secrets-config';
import { headers } from 'next/headers';
import { getClientIp } from '@/lib/network';

export async function executeSetup(formData: {
  // Step 1
  projectName: string;
  projectSlug: string;
  // Step 2
  companyName?: string;
  companyCnpj?: string;
  companyEmail?: string;
  companyPhone?: string;
  // Step 3
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  // Step 4
  primaryColor: string;
  defaultTheme: string;
  loginLayout: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  // Step 5
  // Email (optional - can be configured later)
  skipEmailConfig: boolean;
  emailProvider: string;
  emailApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail: string;
  fromName?: string;
  emailPasswordEnabled: boolean;
  magicLinkEnabled: boolean;
  otpEnabled: boolean;
  turnstileEnabled: boolean;
  turnstileSiteKey?: string;
  turnstileSecretKey?: string;
}) {
  try {
    // Validate password
    const passwordCheck = validatePasswordStrength(formData.adminPassword);
    if (!passwordCheck.valid) {
      return { success: false, error: passwordCheck.errors.join(', ') };
    }

    // Validate Hex color
    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (formData.primaryColor && !hexRegex.test(formData.primaryColor)) {
      return { success: false, error: 'A cor primária deve ser um valor HEX válido.' };
    }

    // Hash password
    const passwordHash = await hashPassword(formData.adminPassword);

    // Create everything in a transaction
    const adminUserId = await db.$transaction(async (tx) => {
      // 0. Prevenir TOCTOU (Race condition no setup)
      const existingConfig = await tx.systemConfig.findUnique({
        where: { key: 'setup_complete' },
      });

      if (existingConfig) {
        throw new Error('Sistema já foi configurado.');
      }

      // 1. Create default permissions
      const permissions = [
        { resource: '*', action: 'manage', description: 'Acesso total ao sistema' },
        { resource: 'users', action: 'manage', description: 'Gerenciar usuários' },
        { resource: 'users', action: 'create', description: 'Criar usuários' },
        { resource: 'users', action: 'read', description: 'Visualizar usuários' },
        { resource: 'users', action: 'update', description: 'Editar usuários' },
        { resource: 'users', action: 'delete', description: 'Excluir usuários' },
        { resource: 'roles', action: 'manage', description: 'Gerenciar cargos' },
        { resource: 'roles', action: 'read', description: 'Visualizar cargos' },
        { resource: 'invites', action: 'manage', description: 'Gerenciar convites' },
        { resource: 'settings', action: 'manage', description: 'Gerenciar configurações' },
        { resource: 'settings', action: 'read', description: 'Visualizar configurações' },
        { resource: 'audit', action: 'read', description: 'Visualizar logs de auditoria' },
        { resource: 'sessions', action: 'manage', description: 'Gerenciar sessões' },
      ];

      const createdPerms = [];
      for (const perm of permissions) {
        const created = await tx.permission.create({ data: perm });
        createdPerms.push(created);
      }

      // 2. Create default roles
      const ownerRole = await tx.role.create({
        data: {
          name: 'Owner',
          description: 'Proprietário do sistema com acesso total',
          isSystem: true,
          permissions: {
            create: {
              permissionId: createdPerms.find(p => p.resource === '*' && p.action === 'manage')!.id,
            },
          },
        },
      });

      const adminRole = await tx.role.create({
        data: {
          name: 'Admin',
          description: 'Administrador com acesso amplo',
          isSystem: true,
          permissions: {
            create: createdPerms
              .filter(p => {
                if (p.resource === '*') return false;
                if (p.resource === 'users' && p.action === 'manage') return true;
                if (p.resource === 'roles' && p.action === 'read') return true;
                if (p.resource === 'invites' && p.action === 'manage') return true;
                if (p.resource === 'settings' && p.action === 'manage') return true;
                if (p.resource === 'audit' && p.action === 'read') return true;
                if (p.resource === 'sessions' && p.action === 'manage') return true;
                return false;
              })
              .map(p => ({ permissionId: p.id })),
          },
        },
      });

      await tx.role.create({
        data: {
          name: 'Member',
          description: 'Membro com acesso básico',
          isDefault: true,
          isSystem: true,
          permissions: {
            create: createdPerms
              .filter(p => p.action === 'read' && (p.resource === 'users' || p.resource === 'roles' || p.resource === 'settings'))
              .map(p => ({ permissionId: p.id })),
          },
        },
      });

      // 3. Create admin user
      const adminUser = await tx.user.create({
        data: {
          name: formData.adminName,
          email: formData.adminEmail.toLowerCase(),
          passwordHash,
          emailVerified: new Date(),
          isOwner: true,
          isActive: true,
          roles: {
            create: { roleId: ownerRole.id },
          },
        },
      });

      // 4. Theme config
      await tx.themeConfig.create({
        data: {
          projectName: formData.projectName,
          companyName: formData.companyName,
          companyCnpj: formData.companyCnpj,
          companyEmail: formData.companyEmail,
          companyPhone: formData.companyPhone,
          primaryColor: formData.primaryColor,
          defaultTheme: formData.defaultTheme,
          loginLayout: formData.loginLayout,
          logoLightUrl: formData.logoLightUrl,
          logoDarkUrl: formData.logoDarkUrl,
          faviconUrl: formData.faviconUrl,
        },
      });

      // 5. Email config (skip if user chose to configure later)
      if (!formData.skipEmailConfig) {
        const emailData = encryptEmailConfigData({
          provider: formData.emailProvider,
          apiKey: formData.emailApiKey,
          smtpHost: formData.smtpHost,
          smtpPort: formData.smtpPort,
          smtpUser: formData.smtpUser,
          smtpPass: formData.smtpPass,
          fromEmail: formData.fromEmail,
          fromName: formData.fromName || formData.projectName,
        });
        await tx.emailConfig.create({ data: emailData });
      } else {
        // Create minimal config so the system knows email is pending
        await tx.emailConfig.create({
          data: {
            provider: 'resend',
            fromEmail: formData.adminEmail,
            fromName: formData.projectName,
          },
        });
      }

      // 6. Auth config
      const authData = encryptAuthConfigData({
        emailPasswordEnabled: formData.emailPasswordEnabled,
        magicLinkEnabled: formData.magicLinkEnabled,
        otpEnabled: formData.otpEnabled,
        turnstileEnabled: formData.turnstileEnabled,
        turnstileSiteKey: formData.turnstileSiteKey,
        turnstileSecretKey: formData.turnstileSecretKey,
      });
      await tx.authConfig.create({ data: authData });

      // 7. System config
      await tx.systemConfig.create({
        data: { key: 'setup_complete', value: 'true' },
      });

      await tx.systemConfig.create({
        data: { key: 'project_slug', value: formData.projectSlug },
      });

      return adminUser.id;
    });

    // 8. Create session for admin (OUTSIDE transaction — user is now committed)
    const headersList = await headers();
    const ip = getClientIp(headersList);
    const ua = headersList.get('user-agent') || 'unknown';

    await createSession({
      userId: adminUserId,
      ipAddress: ip,
      userAgent: ua,
    });

    // 9. Audit log
    await logAudit({
      userId: adminUserId,
      action: AuditAction.SETUP_COMPLETE,
      resource: 'system',
      metadata: {
        projectName: formData.projectName,
        adminEmail: formData.adminEmail,
      },
      ipAddress: ip,
      userAgent: ua,
    });

    return { success: true };
  } catch (error) {
    console.error('[Setup] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao configurar o sistema.',
    };
  }
}
