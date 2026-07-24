import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getProviderConfig, generateState, buildAuthorizationUrl, generateCodeVerifier, generateCodeChallenge } from '@/lib/auth/oauth';
import { cookies } from 'next/headers';

const VALID_PROVIDERS = ['google', 'github', 'microsoft'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.redirect(new URL('/login?error=invalid_provider', request.url));
  }

  // Check if the provider is enabled in DB
  const authConfig = await db.authConfig.findFirst();
  const enabledKey = `${provider}Enabled` as keyof typeof authConfig;

  if (!authConfig || !authConfig[enabledKey]) {
    return NextResponse.redirect(new URL('/login?error=provider_disabled', request.url));
  }

  // Get provider config (tries DB keys first, then env vars)
  const config = getProviderConfig(provider, authConfig);

  if (!config || !config.clientId || !config.clientSecret) {
    return NextResponse.redirect(new URL('/login?error=provider_not_configured', request.url));
  }

  // Generate CSRF state token and store in cookie
  const state = generateState();
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutes
  };

  cookieStore.set(`oauth_state_${provider}`, state, cookieOptions);
  cookieStore.set(`oauth_verifier_${provider}`, verifier, cookieOptions);

  // Build authorization URL and redirect
  const authUrl = buildAuthorizationUrl(config, provider, state, challenge);
  return NextResponse.redirect(authUrl);
}
