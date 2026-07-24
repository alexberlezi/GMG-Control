import ldap from 'ldapjs';
import { getDecryptedAuthConfig } from '@/lib/auth/secrets-config';

export interface LdapConfig {
  ldapUrl: string;
  ldapBaseDn: string;
  ldapBindDn: string;
  ldapBindPassword: string;
  ldapSearchFilter: string;
  ldapTlsEnabled: boolean;
  ldapTlsAllowSelfSigned: boolean;
  ldapCaCert?: string | null;
}

// RFC 4515 LDAP Filter Escape
function escapeLdapFilter(str: string): string {
  return str.replace(/[\*\(\)\\\x00]/g, (char) => {
    return '\\' + char.charCodeAt(0).toString(16).padStart(2, '0');
  });
}

export interface LdapUserAttributes {
  dn: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
}

function normalizeUrl(url: string, tlsEnabled: boolean): string {
  let normalized = url.trim();

  // Auto-prepend protocol if missing
  if (!normalized.startsWith('ldap://') && !normalized.startsWith('ldaps://')) {
    const protocol = tlsEnabled ? 'ldaps://' : 'ldap://';
    normalized = `${protocol}${normalized}`;
  }

  // Add default port if not specified
  const urlWithoutProtocol = normalized.replace(/^ldaps?:\/\//, '');
  if (!urlWithoutProtocol.includes(':')) {
    const defaultPort = normalized.startsWith('ldaps://') ? '636' : '389';
    normalized = `${normalized}:${defaultPort}`;
  }

  return normalized;
}

function createClient(config: LdapConfig): ldap.Client {
  const url = normalizeUrl(config.ldapUrl, config.ldapTlsEnabled);

  const tlsOptions: any = {};
  if (config.ldapTlsEnabled) {
    tlsOptions.rejectUnauthorized = !config.ldapTlsAllowSelfSigned;
    if (config.ldapCaCert && config.ldapCaCert.trim() !== '') {
      tlsOptions.ca = [config.ldapCaCert];
    }
  }

  const client = ldap.createClient({
    url,
    connectTimeout: 10000,
    timeout: 10000,
    tlsOptions: config.ldapTlsEnabled ? tlsOptions : undefined,
  });

  return client;
}

function bindAsync(client: ldap.Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function searchAsync(
  client: ldap.Client,
  baseDn: string,
  options: ldap.SearchOptions
): Promise<ldap.SearchEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: ldap.SearchEntry[] = [];

    client.search(baseDn, options, (err, res) => {
      if (err) {
        reject(err);
        return;
      }

      res.on('searchEntry', (entry) => {
        entries.push(entry);
      });

      res.on('error', (searchErr) => {
        reject(searchErr);
      });

      res.on('end', (result) => {
        if (result?.status !== 0) {
          reject(new Error(`LDAP search failed with status ${result?.status}`));
        } else {
          resolve(entries);
        }
      });
    });
  });
}

function unbindAsync(client: ldap.Client): Promise<void> {
  return new Promise((resolve) => {
    client.unbind((err) => {
      resolve(); // always resolve, even on error
    });
  });
}

function getAttributeValue(entry: ldap.SearchEntry, attr: string): string | null {
  // Use the attributes array from ldapjs SearchEntry
  const attribute = entry.attributes?.find(
    (a: any) => a.type?.toLowerCase() === attr.toLowerCase()
  );
  if (attribute) {
    const vals = (attribute as any).values || (attribute as any).vals;
    if (vals && vals.length > 0) {
      return vals[0].toString();
    }
  }

  // Fallback: try the object representation
  const obj = (entry as any).object || (entry as any).ppiObject;
  if (obj) {
    const keys = Object.keys(obj);
    const key = keys.find(k => k.toLowerCase() === attr.toLowerCase());
    if (key) {
      const val = obj[key];
      return Array.isArray(val) ? val[0] : val;
    }
  }

  return null;
}

/**
 * Test LDAP connection using admin bind credentials.
 */
export async function testLdapConnection(config: LdapConfig): Promise<{ success: boolean; error?: string }> {
  if (!config.ldapBindPassword) {
    return { success: false, error: 'Senha de bind não pode ser vazia.' };
  }

  const client = createClient(config);

  try {
    await bindAsync(client, config.ldapBindDn, config.ldapBindPassword);
    await unbindAsync(client);
    return { success: true };
  } catch (err: any) {
    await unbindAsync(client).catch(() => {});

    if (err.code === 'ECONNREFUSED') {
      return { success: false, error: 'Conexão recusada. Verifique a URL e a porta do servidor LDAP.' };
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
      return { success: false, error: 'Timeout na conexão. O servidor LDAP não respondeu a tempo.' };
    }
    if (err.name === 'InvalidCredentialsError' || err.code === 49) {
      return { success: false, error: 'Credenciais de bind inválidas. Verifique o Bind DN e a senha.' };
    }

    return { success: false, error: `Erro LDAP: ${err.message || 'Falha desconhecida'}` };
  }
}

/**
 * Authenticate a user against the LDAP directory.
 * 
 * Flow:
 * 1. Admin bind (using bindDn/bindPassword)
 * 2. Search for user DN using the search filter
 * 3. User bind (using found DN + user's password)
 * 4. Extract user attributes (email, name)
 */
export async function authenticateWithLdap(
  config: LdapConfig,
  username: string,
  password: string
): Promise<{ success: boolean; user?: LdapUserAttributes; error?: string }> {
  if (!password) {
    return { success: false, error: 'Senha não pode ser vazia.' };
  }
  if (!username) {
    return { success: false, error: 'Usuário não pode ser vazio.' };
  }

  const client = createClient(config);

  try {
    // Step 1: Admin bind
    await bindAsync(client, config.ldapBindDn, config.ldapBindPassword);

    // Step 2: Search for user
    const escapedUsername = escapeLdapFilter(username);
    const filter = config.ldapSearchFilter.replace(/\{\{username\}\}/g, escapedUsername);

    const entries = await searchAsync(client, config.ldapBaseDn, {
      filter,
      scope: 'sub',
      attributes: ['dn', 'mail', 'email', 'userPrincipalName', 'displayName', 'cn', 'givenName', 'sn', 'sAMAccountName'],
    });

    if (entries.length === 0) {
      await unbindAsync(client);
      return { success: false, error: 'Usuário não encontrado no diretório.' };
    }

    const entry = entries[0];
    const userDn = entry.dn.toString();

    // Extract attributes
    const email =
      getAttributeValue(entry, 'mail') ||
      getAttributeValue(entry, 'email') ||
      getAttributeValue(entry, 'userPrincipalName') ||
      `${username}@ldap.local`;

    const displayName =
      getAttributeValue(entry, 'displayName') ||
      getAttributeValue(entry, 'cn') ||
      username;

    const firstName = getAttributeValue(entry, 'givenName') || undefined;
    const lastName = getAttributeValue(entry, 'sn') || undefined;

    // Step 3: User bind (verify password)
    const userClient = createClient(config);

    try {
      await bindAsync(userClient, userDn, password);
      await unbindAsync(userClient);
    } catch (bindErr: any) {
      await unbindAsync(userClient).catch(() => {});
      await unbindAsync(client).catch(() => {});

      if (bindErr.name === 'InvalidCredentialsError' || bindErr.code === 49) {
        return { success: false, error: 'Senha incorreta.' };
      }
      return { success: false, error: `Falha na autenticação: ${bindErr.message}` };
    }

    await unbindAsync(client);

    return {
      success: true,
      user: {
        dn: userDn,
        email: email.toLowerCase(),
        displayName,
        firstName,
        lastName,
      },
    };
  } catch (err: any) {
    await unbindAsync(client).catch(() => {});

    if (err.code === 'ECONNREFUSED') {
      return { success: false, error: 'Servidor LDAP indisponível.' };
    }

    return { success: false, error: `Erro LDAP: ${err.message || 'Falha desconhecida'}` };
  }
}

/**
 * Get decrypted LDAP config from the database.
 */
export async function getLdapConfig(): Promise<LdapConfig | null> {
  const authConfig = await getDecryptedAuthConfig();

  if (!authConfig || !authConfig.ldapEnabled) return null;
  if (!authConfig.ldapUrl || !authConfig.ldapBaseDn || !authConfig.ldapBindDn || !authConfig.ldapBindPassword) {
    return null;
  }

  return {
    ldapUrl: authConfig.ldapUrl,
    ldapBaseDn: authConfig.ldapBaseDn,
    ldapBindDn: authConfig.ldapBindDn,
    ldapBindPassword: authConfig.ldapBindPassword,
    ldapSearchFilter: authConfig.ldapSearchFilter || '(sAMAccountName={{username}})',
    ldapTlsEnabled: authConfig.ldapTlsEnabled,
    ldapTlsAllowSelfSigned: authConfig.ldapTlsAllowSelfSigned,
    ldapCaCert: authConfig.ldapCaCert,
  };
}
