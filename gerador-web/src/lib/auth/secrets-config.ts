import { db } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/auth/secrets';

/**
 * Helper to safely decrypt a value, returning null if it fails.
 */
function safeDecrypt(value: string | null | undefined, fieldName?: string): string | null {
  if (!value) return null;
  // If the value is not encrypted (e.g. from a fresh db install before migration),
  // we could just return it. But the migration script ensures all are encrypted.
  try {
    return decrypt(value);
  } catch {
    console.error(`[Security Critical] Falha ao decriptar o campo ${fieldName || 'desconhecido'}. Possível corrupção ou chave incorreta.`);
    return null;
  }
}

/**
 * Obtém AuthConfig com campos sensíveis já descriptografados.
 */
export async function getDecryptedAuthConfig() {
  const config = await db.authConfig.findFirst();
  if (!config) return null;

  return {
    ...config,
    ldapBindPassword: safeDecrypt(config.ldapBindPassword, 'ldapBindPassword'),
    googleClientSecret: safeDecrypt(config.googleClientSecret, 'googleClientSecret'),
    githubClientSecret: safeDecrypt(config.githubClientSecret, 'githubClientSecret'),
    microsoftClientSecret: safeDecrypt(config.microsoftClientSecret, 'microsoftClientSecret'),
    facebookClientSecret: safeDecrypt(config.facebookClientSecret, 'facebookClientSecret'),
    turnstileSecretKey: safeDecrypt(config.turnstileSecretKey, 'turnstileSecretKey'),
  };
}

/**
 * Obtém EmailConfig com campos sensíveis já descriptografados.
 */
export async function getDecryptedEmailConfig() {
  const config = await db.emailConfig.findFirst();
  if (!config) return null;

  return {
    ...config,
    smtpPass: safeDecrypt(config.smtpPass, 'smtpPass'),
    apiKey: safeDecrypt(config.apiKey, 'apiKey'),
  };
}

/**
 * Recebe um payload de AuthConfig, cifra os campos sensíveis presentes e o retorna.
 */
export function encryptAuthConfigData<T extends Record<string, any>>(data: T): T {
  const result = { ...data };
  const sensitiveFields = [
    'ldapBindPassword',
    'googleClientSecret',
    'githubClientSecret',
    'microsoftClientSecret',
    'facebookClientSecret',
    'turnstileSecretKey',
  ];

  for (const field of sensitiveFields) {
    if (result[field]) {
      if (result[field] === '__UNCHANGED_SECRET__') {
        delete result[field];
      } else {
        result[field as keyof T] = encrypt(result[field]) as any;
      }
    }
  }

  return result;
}

/**
 * Recebe um payload de EmailConfig, cifra os campos sensíveis presentes e o retorna.
 */
export function encryptEmailConfigData<T extends Record<string, any>>(data: T): T {
  const result = { ...data };
  const sensitiveFields = ['smtpPass', 'apiKey'];

  for (const field of sensitiveFields) {
    if (result[field]) {
      if (result[field] === '__UNCHANGED_SECRET__') {
        delete result[field];
      } else {
        result[field as keyof T] = encrypt(result[field]) as any;
      }
    }
  }

  return result;
}
