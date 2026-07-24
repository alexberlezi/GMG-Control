import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import AcceptInviteClient from './accept-invite-client';
import Link from 'next/link';

export const metadata = {
  title: 'Aceitar Convite | AuthForge',
};

export default async function InvitePage({ params }: { params: { token: string } }) {
  const { token } = params;

  if (!token) {
    redirect('/login');
  }

  // Busca o convite pelo token
  const invite = await db.invite.findUnique({
    where: { token },
    include: { role: true }
  });

  const themeConfig = await db.themeConfig.findFirst() || {
    projectName: 'AuthForge',
    logoLightUrl: null,
    logoDarkUrl: null,
  };

  // Se não encontrar o convite, mostra erro amigável
  if (!invite) {
    return <InviteErrorState message="Este link de convite é inválido ou não existe." theme={themeConfig} />;
  }

  // Se já foi aceito
  if (invite.status === 'ACCEPTED') {
    return <InviteErrorState message="Este convite já foi utilizado e a conta foi criada." theme={themeConfig} actionText="Ir para o Login" actionUrl="/login" />;
  }

  // Se foi cancelado
  if (invite.status === 'CANCELLED') {
    return <InviteErrorState message="Este convite foi cancelado pelo administrador." theme={themeConfig} />;
  }

  // Se está expirado ou a data atual passou
  if (invite.status === 'EXPIRED' || new Date() > invite.expiresAt) {
    return <InviteErrorState message="Este link de convite expirou. Solicite um novo convite ao administrador." theme={themeConfig} />;
  }

  // Se for PENDING e ainda não expirou, mostra o formulário de aceite
  return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-on-surface tracking-tight">{themeConfig.projectName}</h1>
            <p className="text-on-surface-variant mt-2 text-sm">
              Você foi convidado para participar como <strong className="text-primary">{invite.role.name}</strong>
            </p>
          </div>

          <div className="card p-6 sm:p-8 shadow-2xl border-outline-variant/10">
            <AcceptInviteClient token={token} email={invite.email} />
          </div>
        </div>
      </div>
  );
}

function InviteErrorState({ message, theme, actionText, actionUrl }: any) {
  return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="text-3xl font-black text-on-surface tracking-tight">{theme?.projectName || 'AuthForge'}</h1>
          
          <div className="card p-8 border-red-500/20 bg-red-500/5">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <h2 className="text-xl font-bold text-on-surface mb-2">Convite Inválido</h2>
            <p className="text-on-surface-variant text-sm mb-6">{message}</p>
            
            <Link href={actionUrl || "/"} className="btn btn-primary w-full justify-center">
              {actionText || "Voltar ao Início"}
            </Link>
          </div>
        </div>
      </div>
  );
}
