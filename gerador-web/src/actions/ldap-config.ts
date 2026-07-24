'use server';

import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth/wrapper';
import { encrypt } from '@/lib/auth/secrets';
import { testLdapConnection, type LdapConfig } from '@/lib/auth/ldap';
import { logAudit, AuditAction } from '@/lib/audit';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getClientIp } from '@/lib/network';

export const saveLdapConfig = withAuth(async (session, data: {
  ldapUrl: string;
  ldapBaseDn: string;
  ldapBindDn: string;
  ldapBindPassword?: string; // optional — only sent if changed
  ldapSearchFilter: string;
  ldapTlsEnabled: boolean;
  ldapTlsAllowSelfSigned: boolean;
  ldapCaCert?: string;
  ldapFallbackToLocal: boolean;
}) => {
  try {
    if (!session.user.isOwner) {
      return { success: false, error: 'Sem permissão.' };
    }

    const config = await db.authConfig.findFirst();
    if (!config) {
      return { success: false, error: 'Configuração não encontrada.' };
    }

    if (data.ldapCaCert && data.ldapCaCert.trim() !== '') {
      const pemRegex = /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/;
      if (!pemRegex.test(data.ldapCaCert)) {
        return { success: false, error: 'O certificado CA fornecido não é um PEM válido.' };
      }
    }

    const urlChanged = data.ldapUrl !== config.ldapUrl;
    const passwordChanged = !!data.ldapBindPassword && data.ldapBindPassword.trim() !== '';

    if (urlChanged && !passwordChanged && config.ldapBindPassword) {
      return { success: false, error: 'Ao alterar a URL do servidor LDAP, você deve fornecer a Senha de Bind novamente por segurança.' };
    }

    const updateData: any = {
      ldapUrl: data.ldapUrl,
      ldapBaseDn: data.ldapBaseDn,
      ldapBindDn: data.ldapBindDn,
      ldapSearchFilter: data.ldapSearchFilter || '(sAMAccountName={{username}})',
      ldapTlsEnabled: data.ldapTlsEnabled,
      ldapTlsAllowSelfSigned: data.ldapTlsAllowSelfSigned,
      ldapCaCert: data.ldapCaCert || null,
      ldapFallbackToLocal: data.ldapFallbackToLocal,
    };

    // Only update password if provided (not empty = user changed it)
    if (passwordChanged) {
      updateData.ldapBindPassword = encrypt(data.ldapBindPassword!);
    }

    await db.authConfig.update({
      where: { id: config.id },
      data: updateData,
    });

    const headersList = await headers();
    const ip = getClientIp(headersList);
    const ua = headersList.get('user-agent') || 'unknown';

    await logAudit({
      action: AuditAction.LDAP_CONFIG_UPDATE,
      userId: session.user.id,
      metadata: { fields: Object.keys(updateData).filter(k => k !== 'ldapBindPassword') },
      ipAddress: ip,
      userAgent: ua,
    });

    revalidatePath('/dashboard/settings/auth');
    revalidatePath('/login');

    return { success: true };
  } catch (error: any) {
    console.error('Error saving LDAP config:', error);
    return { success: false, error: 'Erro ao salvar configuração LDAP.' };
  }
});

export const testLdapConnectionAction = withAuth(async (session, data: {
  ldapUrl: string;
  ldapBaseDn: string;
  ldapBindDn: string;
  ldapBindPassword: string;
  ldapSearchFilter: string;
  ldapTlsEnabled: boolean;
  ldapTlsAllowSelfSigned: boolean;
  ldapCaCert?: string;
}) => {
  try {
    if (!session.user.isOwner) {
      return { success: false, error: 'Sem permissão.' };
    }

    const config = await db.authConfig.findFirst();

    // If password is empty, try to get from DB (user didn't change it)
    let password = data.ldapBindPassword;
    if (!password || password.trim() === '') {
      if (config && data.ldapUrl !== config.ldapUrl) {
        return { success: false, error: 'Ao testar com uma URL diferente, forneça a Senha de Bind novamente.' };
      }

      // If password field is empty, trying to get from DB...
      if (config?.ldapBindPassword) {

        try {
          const { decrypt } = await import('@/lib/auth/secrets');
          password = decrypt(config.ldapBindPassword);

        } catch (decryptErr) {
          console.error('[LDAP Test] Decrypt failed:', decryptErr);
          return { success: false, error: 'Falha ao descriptografar a senha do banco. Por favor, reconfigure a senha de Bind.' };
        }
      } else {

      }
    } else {

    }

    if (!password) {
      return { success: false, error: 'Senha de bind não configurada. Preencha a senha e salve antes de testar.' };
    }



    const ldapConfig: LdapConfig = {
      ldapUrl: data.ldapUrl,
      ldapBaseDn: data.ldapBaseDn,
      ldapBindDn: data.ldapBindDn,
      ldapBindPassword: password,
      ldapSearchFilter: data.ldapSearchFilter || '(sAMAccountName={{username}})',
      ldapTlsEnabled: data.ldapTlsEnabled,
      ldapTlsAllowSelfSigned: data.ldapTlsAllowSelfSigned,
      ldapCaCert: data.ldapCaCert,
    };

    const result = await testLdapConnection(ldapConfig);
    return result;
  } catch (error: any) {
    console.error('Error testing LDAP connection:', error);
    return { success: false, error: 'Erro ao testar conexão LDAP.' };
  }
});
