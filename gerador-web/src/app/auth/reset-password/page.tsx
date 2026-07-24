import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import ResetPasswordClient from './reset-password-client';
import { peekVerificationToken } from '@/lib/auth/tokens';
export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    redirect('/login?error=Token_Ausente');
  }

  const verification = await peekVerificationToken({ token, type: 'PASSWORD_RESET' });

  if (!verification) {
    redirect('/login?error=Token_Invalido_ou_Expirado');
  }

  const user = await db.user.findUnique({ where: { email: verification.email } });
  if (!user) {
    redirect('/login?error=Usuario_Nao_Encontrado');
  }

  return <ResetPasswordClient token={token} email={verification.email} />;
}
