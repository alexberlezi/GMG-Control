'use server';

import { db } from '@/lib/db';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';

export async function acceptInvite(token: string, name: string, password: string) {
  try {
    // 1. Busca o convite novamente para segurança
    const invite = await db.invite.findUnique({
      where: { token },
      include: { role: true }
    });

    if (!invite) return { success: false, error: 'Convite inválido.' };
    if (invite.status !== 'PENDING') return { success: false, error: 'Este convite não está mais pendente.' };
    if (new Date() > invite.expiresAt) return { success: false, error: 'Este convite expirou.' };

    // Validar força da senha
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return { success: false, error: passwordCheck.errors[0] };
    }

    // 2. Hash da senha
    const passwordHash = await hashPassword(password);

    // 3. Cria o usuário e invalida o convite (Transaction)
    await db.$transaction(async (tx) => {
      // Cria o usuário
      const user = await tx.user.create({
        data: {
          email: invite.email,
          name,
          passwordHash,
          emailVerified: new Date(), 
          isActive: true,
        }
      });

      // Atribui o grupo do convite ao usuário
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: invite.role.id,
        }
      });

      // Marca o convite como aceito
      await tx.invite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' }
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error('Erro ao aceitar convite:', error);
    // Verificar se o email já existe por conta de race condition
    if (error.code === 'P2002') {
      return { success: false, error: 'Já existe uma conta com este e-mail.' };
    }
    return { success: false, error: 'Ocorreu um erro ao criar sua conta. Tente novamente.' };
  }
}
