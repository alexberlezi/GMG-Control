'use server';

import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth/wrapper';
import { getAuthConfig } from '@/actions/auth-config';
import argon2 from 'argon2';
import { revalidatePath } from 'next/cache';
import { rateLimitByAction } from '@/lib/auth/rate-limit';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email/send';
import { getDecryptedAuthConfig } from '@/lib/auth/secrets-config';
import { createVerificationToken } from '@/lib/auth/tokens';
import { escapeHtml } from '@/lib/email/templates';

export const updateProfile = withAuth(async (session, data: { name: string; email: string; avatarUrl?: string | null }) => {
  try {
    const { name, email, avatarUrl } = data;

    if (!name || !email) {
      return { success: false, error: 'Nome e email são obrigatórios.' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Se o email mudar, precisamos verificar
    if (normalizedEmail !== session.user.email) {
      const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        return { success: false, error: 'Este e-mail já está em uso por outra conta.' };
      }

      // Generate EMAIL_CHANGE token (hashed in DB)
      const token = await createVerificationToken({
        email: normalizedEmail,
        type: 'EMAIL_CHANGE',
        userId: session.user.id
      });

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const verifyLink = `http${appUrl.includes('localhost') ? '' : 's'}://${appUrl}/auth/verify-email?token=${token}`;

      // Envia email para o novo endereço com o link de confirmação
      const htmlNew = `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2>Confirme seu novo e-mail</h2>
          <p>Olá, <strong>${escapeHtml(session.user.name)}</strong>.</p>
          <p>Você solicitou a alteração do seu e-mail para esta conta.</p>
          <div style="margin: 30px 0;">
            <a href="${verifyLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Confirmar E-mail</a>
          </div>
          <p style="color: #666; font-size: 12px;">Se você não fez esta solicitação, ignore este e-mail.</p>
        </div>
      `;
      await sendEmail({
        to: normalizedEmail,
        subject: 'Confirme seu novo e-mail',
        html: htmlNew
      });

      // Alerta de segurança para o e-mail antigo
      const htmlOld = `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2>Aviso de alteração de e-mail</h2>
          <p>Olá, <strong>${escapeHtml(session.user.name)}</strong>.</p>
          <p>Houve uma solicitação para alterar o e-mail associado a esta conta para <strong>${escapeHtml(normalizedEmail)}</strong>.</p>
          <p>Se você não fez esta solicitação, sua conta pode estar comprometida. Por favor, redefina sua senha imediatamente.</p>
        </div>
      `;
      await sendEmail({
        to: session.user.email,
        subject: 'Alerta de Segurança: Solicitação de alteração de e-mail',
        html: htmlOld
      });
      
      return { success: true, message: 'Um link de confirmação foi enviado para o novo e-mail.' };
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        name,
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
    });

    revalidatePath('/dashboard', 'layout');
    return { success: true };

  } catch (error: any) {
    console.error('Error updating profile:', error);
    return { success: false, error: 'Erro ao atualizar perfil.' };
  }
});

export const updatePassword = withAuth(async (session, currentPassword?: string, newPassword?: string) => {
  try {
    if (!currentPassword || !newPassword) {
      return { success: false, error: 'Preencha as senhas corretamente.' };
    }

    const rateLimit = await rateLimitByAction('update_password', session.user.id, 5, 900000); // 5 attempts per 15 min
    if (!rateLimit.allowed) {
      return { success: false, error: 'Muitas tentativas. Tente novamente mais tarde.' };
    }

    const config = await getAuthConfig();

    if (config && !('error' in config)) {
      if (newPassword.length < config.passwordMinLength) {
        return { success: false, error: 'A nova senha deve ter no mínimo ' + config.passwordMinLength + ' caracteres.' };
      }
      if (config.requireUppercase && !/[A-Z]/.test(newPassword)) {
        return { success: false, error: 'A nova senha deve conter pelo menos uma letra maiúscula.' };
      }
      if (config.requireNumber && !/[0-9]/.test(newPassword)) {
        return { success: false, error: 'A nova senha deve conter pelo menos um número.' };
      }
      if (config.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
        return { success: false, error: 'A nova senha deve conter pelo menos um caractere especial.' };
      }
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || !user.passwordHash) {
      // Se não tem passwordHash, provavelmente logou via OAuth. Não deve trocar senha por aqui.
      return { success: false, error: 'Sua conta não utiliza senha (possivelmente criada via Google/Github).' };
    }

    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) {
      return { success: false, error: 'A senha atual está incorreta.' };
    }

    const newHash = await argon2.hash(newPassword);

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Revoke all other sessions for security
    await db.session.deleteMany({
      where: {
        userId: user.id,
        id: { not: session.id }, // keep current session active
      },
    });

    return { success: true };

  } catch (error: any) {
    console.error('Error updating password:', error);
    return { success: false, error: 'Erro ao alterar senha.' };
  }
});

export const revokeSession = withAuth(async (session, sessionId: string) => {
  try {
    await db.session.deleteMany({
      where: { id: sessionId, userId: session.user.id },
    });

    revalidatePath('/dashboard/profile');
    return { success: true };

  } catch (error: any) {
    console.error('Error revoking session:', error);
    return { success: false, error: 'Erro ao revogar sessão.' };
  }
});

export const revokeAllOtherSessions = withAuth(async (session) => {
  try {
    // Deleta todas as sessões do usuário EXCETO a sessão atual
    await db.session.deleteMany({
      where: {
        userId: session.user.id,
        id: { not: session.id },
      },
    });

    revalidatePath('/dashboard/profile');
    return { success: true };

  } catch (error: any) {
    console.error('Error revoking other sessions:', error);
    return { success: false, error: 'Erro ao revogar outras sessões.' };
  }
});
