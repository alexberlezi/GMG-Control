import crypto from 'crypto';

// ═══════════════════════════════════════
// Provider Definitions
// ═══════════════════════════════════════

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  parseUser: (data: any) => OAuthUser;
}

export interface OAuthUser {
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  providerAccountId: string;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export function getCallbackUrl(provider: string): string {
  return `${getAppUrl()}/api/auth/callback/${provider}`;
}

export function getProviderConfig(provider: string, dbConfig?: any): OAuthProviderConfig | null {
  switch (provider) {
    case 'google':
      return {
        clientId: dbConfig?.googleClientId || process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: dbConfig?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile'],
        parseUser: (data: any) => ({
          email: data.email,
          name: data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim(),
          firstName: data.given_name,
          lastName: data.family_name,
          avatarUrl: data.picture,
          providerAccountId: data.id,
        }),
      };

    case 'github':
      return {
        clientId: dbConfig?.githubClientId || process.env.GITHUB_CLIENT_ID || '',
        clientSecret: dbConfig?.githubClientSecret || process.env.GITHUB_CLIENT_SECRET || '',
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scopes: ['read:user', 'user:email'],
        parseUser: (data: any) => {
          const nameParts = (data.name || data.login || '').split(' ');
          return {
            email: data.email,
            name: data.name || data.login,
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || undefined,
            avatarUrl: data.avatar_url,
            providerAccountId: String(data.id),
          };
        },
      };

    case 'microsoft': {
      const tenantId = process.env.MICROSOFT_TENANT_ID;
      if (!tenantId || tenantId === 'common') {
        console.warn('MICROSOFT_TENANT_ID não configurado. Login da Microsoft desativado para prevenir vulnerabilidade nOAuth.');
        return null;
      }
      return {
        clientId: dbConfig?.microsoftClientId || process.env.MICROSOFT_CLIENT_ID || '',
        clientSecret: dbConfig?.microsoftClientSecret || process.env.MICROSOFT_CLIENT_SECRET || '',
        authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        scopes: ['openid', 'email', 'profile', 'User.Read'],
        parseUser: (data: any) => ({
          email: data.mail || data.userPrincipalName,
          name: data.displayName || `${data.givenName || ''} ${data.surname || ''}`.trim(),
          firstName: data.givenName,
          lastName: data.surname,
          avatarUrl: undefined, // MS Graph requires separate call for photo
          providerAccountId: data.id,
        }),
      };
    }

    default:
      return null;
  }
}

// ═══════════════════════════════════════
// OAuth Flow Helpers
// ═══════════════════════════════════════

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function buildAuthorizationUrl(
  config: OAuthProviderConfig,
  provider: string,
  state: string,
  codeChallenge?: string
): string {
  const params: Record<string, string> = {
    client_id: config.clientId,
    redirect_uri: getCallbackUrl(provider),
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'select_account',
  };

  if (codeChallenge) {
    params.code_challenge = codeChallenge;
    params.code_challenge_method = 'S256';
  }

  const queryParams = new URLSearchParams(params);

  return `${config.authorizationUrl}?${queryParams.toString()}`;
}

export async function exchangeCodeForTokens(
  config: OAuthProviderConfig,
  provider: string,
  code: string,
  codeVerifier?: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const params: Record<string, string> = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: getCallbackUrl(provider),
    grant_type: 'authorization_code',
  };

  if (codeVerifier) {
    params.code_verifier = codeVerifier;
  }

  const body = new URLSearchParams(params);

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function fetchUserInfo(
  config: OAuthProviderConfig,
  accessToken: string,
): Promise<OAuthUser> {
  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  const data = await response.json();
  return config.parseUser(data);
}

// GitHub email can be private — need separate API call
export async function fetchGitHubPrimaryEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;

    const emails: { email: string; primary: boolean; verified: boolean }[] = await response.json();
    const primary = emails.find((e) => e.primary && e.verified);
    return primary?.email || emails.find((e) => e.verified)?.email || null;
  } catch {
    return null;
  }
}
