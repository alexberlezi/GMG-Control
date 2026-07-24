'use server';

import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { logAudit, AuditAction } from '@/lib/audit';
import { headers } from 'next/headers';
import { createVerificationToken } from '@/lib/auth/tokens';
import { rateLimitByIP, rateLimitByAction } from '@/lib/auth/rate-limit';
import { escapeHtml } from '@/lib/email/templates';
import { getClientIp } from '@/lib/network';

export async function requestMagicLink(emailAddress: string) {
  const email = emailAddress.toLowerCase();
  try {
    const headersList = await headers();
    const ip = getClientIp(headersList);

    // Rate Limit IP (overall)
    const ipLimit = await rateLimitByIP(ip, 20, 60000);
    if (!ipLimit.allowed) {
      return { success: false, error: 'Muitas requisições. Aguarde um momento.' };
    }

    // Rate Limit by Email to prevent spam
    const emailLimit = await rateLimitByAction('magic_link', email, 3, 900000); // 3 per 15 min
    if (!emailLimit.allowed) {
      return { success: true, message: 'Se o e-mail estiver cadastrado, um link será enviado.' };
    }

    const authConfig = await db.authConfig.findFirst();
    if (!authConfig?.magicLinkEnabled) {
      return { success: false, error: 'Magic Link desativado.' };
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Security: don't reveal if user exists
      return { success: true, message: 'Se o e-mail estiver cadastrado, um link será enviado.' };
    }

    if (!user.isActive) {
      // Security: don't reveal if user exists or is inactive
      return { success: true, message: 'Se o e-mail estiver cadastrado, um link será enviado.' };
    }

    // Generate secure token (automatically hashed for storage)
    const token = await createVerificationToken({ email: user.email, type: 'MAGIC_LINK', userId: user.id });

    // Generate link
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const magicLink = `${protocol}://${host}/auth/verify?token=${token}`;

    // Get theme config for branding
    const themeConfig = await db.themeConfig.findFirst();
    const projectName = themeConfig?.projectName || 'AuthForge';

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; text-align: center; margin-bottom: 8px;">${escapeHtml(projectName)}</h2>
        <p style="color: #94a3b8; text-align: center; font-size: 13px; margin-bottom: 32px;">Acesso Seguro via Magic Link</p>
        
        <p style="color: #334155; font-size: 16px;">Olá, <strong>${escapeHtml(user.name)}</strong>!</p>
        <p style="color: #334155; font-size: 15px;">Você solicitou um acesso sem senha. Clique no botão abaixo para entrar (o link expira em <strong>15 minutos</strong>):</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${magicLink}" style="background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
            🔐 Fazer Login Seguro
          </a>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 32px;">
          Se você não solicitou este acesso, ignore este e-mail com segurança.<br/>
          Este link é de uso único e expira automaticamente.
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: user.email,
      subject: `Seu acesso ao ${projectName} 🔐`,
      html: htmlContent,
    });

    if (result.success) {
      await logAudit({
        action: AuditAction.MAGIC_LINK_REQUEST,
        userId: user.id,
        metadata: { email: user.email },
        ipAddress: getClientIp(headersList),
        userAgent: headersList.get('user-agent') || 'unknown',
      });
      return { success: true, message: 'Se o e-mail estiver cadastrado, um link será enviado.' };
    } else {
      return { success: false, error: 'Erro ao despachar o e-mail. Verifique suas configurações de SMTP/Resend.' };
    }

  } catch (error) {
    console.error('Magic Link Error:', error);
    return { success: false, error: 'Erro interno ao gerar o link mágico.' };
  }
}
