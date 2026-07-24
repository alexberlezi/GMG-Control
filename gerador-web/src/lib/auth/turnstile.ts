/**
 * Cloudflare Turnstile verification (ADR-002)
 * Server-side validation of turnstile tokens
 */
import { getDecryptedAuthConfig } from '@/lib/auth/secrets-config';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResult {
  success: boolean;
  error?: string;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  secretKey: string | null | undefined,
): Promise<TurnstileVerifyResult> {
  // Graceful degradation: if Turnstile is not configured, allow through
  if (!secretKey) {
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'Token de verificação não fornecido' };
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: 'Falha na verificação de segurança. Tente novamente.',
    };
  } catch {
    // Fail closed on network errors
    console.error('[Turnstile] Verification request failed');
    return { success: false, error: 'Erro de comunicação com o serviço de segurança. Tente novamente mais tarde.' };
  }
}

export async function getTurnstileConfig() {
  const config = await getDecryptedAuthConfig();
  if (!config || !config.turnstileEnabled) {
    return { enabled: false, siteKey: null, secretKey: null };
  }

  return {
    enabled: true,
    siteKey: config.turnstileSiteKey,
    secretKey: config.turnstileSecretKey,
  };
}
