'use server';

import { sendEmail } from '@/lib/email';
import { withAuth } from '@/lib/auth/wrapper';
import { logAudit, AuditAction } from '@/lib/audit';
import { headers } from 'next/headers';
import { getClientIp } from '@/lib/network';
import { rateLimitByAction } from '@/lib/auth/rate-limit';

export const sendTestEmail = withAuth(async (session, toEmail: string) => {
  try {
    if (!session.user.isOwner) {
      return { success: false, error: 'Sem permissão.' };
    }

    const rateLimit = await rateLimitByAction('send_test_email', session.user.id, 5, 900000); // 5 attempts per 15 minutes
    if (!rateLimit.allowed) {
      return { success: false, error: 'Muitas tentativas. Tente novamente mais tarde.' };
    }

    if (!toEmail) {
      return { success: false, error: 'E-mail de destino não informado.' };
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; text-align: center;">AuthForge - Teste de Conexão</h2>
        <p style="color: #334155; font-size: 16px;">Olá,</p>
        <p style="color: #334155; font-size: 16px;">Se você está recebendo este e-mail, significa que a integração do seu servidor de e-mails (SMTP ou Resend) com o sistema AuthForge foi configurada com sucesso!</p>
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin: 20px 0; text-align: center;">
          <strong style="color: #059669;">Conexão Estabelecida! ✅</strong>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center;">Este é um e-mail automático gerado pelo painel administrativo.</p>
      </div>
    `;

    const result = await sendEmail({
      to: toEmail,
      subject: 'Teste de Conexão de E-mail - AuthForge 🚀',
      html: htmlContent,
    });

    if (result.success) {
      const headersList = await headers();
      await logAudit({
        action: AuditAction.TEST_EMAIL_SENT,
        userId: session.user.id,
        metadata: { to: toEmail, providerId: result.messageId || result.id },
        ipAddress: getClientIp(headersList),
        userAgent: headersList.get('user-agent') || 'unknown',
      });
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Falha ao enviar e-mail. Verifique as credenciais.' };
    }

  } catch (error) {
    console.error('Test Email Error:', error);
    return { success: false, error: 'Erro interno ao tentar disparar o e-mail de teste.' };
  }
});
