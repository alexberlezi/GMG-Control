import { getEmailConfig } from '@/actions/email-config';
import EmailSettingsClient from '@/components/dashboard/settings/email-settings-client';
import { validateSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Configurações de E-mail | AuthForge',
};

export default async function EmailSettingsPage() {
  const session = await validateSession();
  if (!session || !session.user.isOwner) {
    redirect('/dashboard?error=access_denied');
  }

  const config = await getEmailConfig();

  if (!config) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Motor de E-mails</h1>
        <p className="text-on-surface-variant mt-1">
          Configure as credenciais do servidor SMTP ou API do Resend para envio de notificações e Magic Links.
        </p>
      </div>

      <EmailSettingsClient initialConfig={config} />
    </div>
  );
}
