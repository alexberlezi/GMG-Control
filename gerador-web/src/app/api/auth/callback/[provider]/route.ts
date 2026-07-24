import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getDecryptedAuthConfig } from '@/lib/auth/secrets-config';
import { createSession } from '@/lib/auth/session';
import { logAudit, AuditAction } from '@/lib/audit';
import {
  getProviderConfig,
  exchangeCodeForTokens,
  fetchUserInfo,
  fetchGitHubPrimaryEmail,
} from '@/lib/auth/oauth';
import { cookies, headers } from 'next/headers';
import { encrypt } from '@/lib/auth/secrets';
import { getClientIp } from '@/lib/network';

const VALID_PROVIDERS = ['google', 'github', 'microsoft'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.redirect(new URL('/login?error=invalid_provider', request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');

  // Handle provider-side errors (user denied access, etc.)
  if (errorParam) {
    console.error(`OAuth ${provider} error:`, errorParam);
    return NextResponse.redirect(new URL('/login?error=oauth_denied', request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=invalid_callback', request.url));
  }

  // Verify CSRF state and PKCE verifier
  const cookieStore = await cookies();
  const storedState = cookieStore.get(`oauth_state_${provider}`)?.value;
  const storedVerifier = cookieStore.get(`oauth_verifier_${provider}`)?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL('/login?error=csrf_mismatch', request.url));
  }

  // Clear state and verifier cookies
  cookieStore.delete(`oauth_state_${provider}`);
  cookieStore.delete(`oauth_verifier_${provider}`);

  try {
    const authConfig = await getDecryptedAuthConfig();
    const config = getProviderConfig(provider, authConfig);

    if (!config) {
      return NextResponse.redirect(new URL('/login?error=provider_not_configured', request.url));
    }

    // Exchange code for tokens (using PKCE verifier if available)
    const tokens = await exchangeCodeForTokens(config, provider, code, storedVerifier);

    // Fetch user info from provider
    const oauthUser = await fetchUserInfo(config, tokens.accessToken);

    // GitHub: email may be private, fetch separately
    if (provider === 'github' && !oauthUser.email) {
      const githubEmail = await fetchGitHubPrimaryEmail(tokens.accessToken);
      if (githubEmail) oauthUser.email = githubEmail;
    }

    if (!oauthUser.email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url));
    }

    // ═══════════════════════════════════════
    // Find or create user + OAuth account
    // ═══════════════════════════════════════

    // Check if an OAuth account already exists for this provider + providerAccountId
    const existingOAuth = await db.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: oauthUser.providerAccountId,
        },
      },
      include: { user: true },
    });

    let user;

    if (existingOAuth) {
      // Existing OAuth account — use the linked user
      user = existingOAuth.user;

      if (!user.isActive) {
        return NextResponse.redirect(new URL('/login?error=account_inactive', request.url));
      }

      // Update tokens
      await db.oAuthAccount.update({
        where: { id: existingOAuth.id },
        data: {
          accessToken: tokens.accessToken ? encrypt(tokens.accessToken) : null,
          refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : existingOAuth.refreshToken,
          expiresAt: tokens.expiresIn ? Math.floor(Date.now() / 1000) + tokens.expiresIn : null,
        },
      });

      // Update user info if changed
      const updates: any = {};
      if (oauthUser.avatarUrl && user.avatarUrl !== oauthUser.avatarUrl) updates.avatarUrl = oauthUser.avatarUrl;
      if (oauthUser.name && user.name !== oauthUser.name) updates.name = oauthUser.name;
      if (Object.keys(updates).length > 0) {
        await db.user.update({ where: { id: user.id }, data: updates });
      }
    } else {
      // No OAuth account — check if user exists by email
      oauthUser.email = oauthUser.email.toLowerCase();
      user = await db.user.findUnique({ where: { email: oauthUser.email } });

      if (user) {
        // Bloqueio de auto-link (nOAuth mitigation)
        // Se o usuário já existe mas não está vinculado a ESTE providerAccountId, não permitimos o vínculo automático.
        return NextResponse.redirect(new URL('/login?error=email_taken', request.url));
      } else {
        // Brand new user — auto-provision
        const defaultRole = await db.role.findFirst({ where: { isDefault: true } });

        user = await db.user.create({
          data: {
            name: oauthUser.name,
            firstName: oauthUser.firstName || null,
            lastName: oauthUser.lastName || null,
            email: oauthUser.email,
            avatarUrl: oauthUser.avatarUrl || null,
            authProvider: provider,
            passwordHash: null,
            emailVerified: new Date(), // OAuth emails are already verified
            ...(defaultRole ? { roles: { create: { roleId: defaultRole.id } } } : {}),
            accounts: {
              create: {
                provider,
                providerAccountId: oauthUser.providerAccountId,
                accessToken: tokens.accessToken ? encrypt(tokens.accessToken) : null,
                refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
                expiresAt: tokens.expiresIn ? Math.floor(Date.now() / 1000) + tokens.expiresIn : null,
              },
            },
          },
        });

        await logAudit({
          userId: user.id,
          action: AuditAction.USER_AUTO_PROVISIONED,
          metadata: { method: provider, email: oauthUser.email },
          ipAddress: 'oauth-callback',
          userAgent: 'oauth-callback',
        });
      }
    }

    // ═══════════════════════════════════════
    // Create session
    // ═══════════════════════════════════════

    const headersList = await headers();
    const ipAddress = getClientIp(headersList);
    const userAgent = headersList.get('user-agent') || 'unknown';

    if (user.twoFactorEnabled) {
      const { SignJWT } = await import('jose');
      const { getSecret } = await import('@/lib/auth/tokens');
      const jwtSecret = getSecret();
      const preAuthToken = await new SignJWT({ userId: user.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('5m')
        .sign(jwtSecret);

      cookieStore.set('preAuthToken', preAuthToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 300,
      });

      return NextResponse.redirect(new URL('/auth/2fa', request.url));
    }

    if (user.mustChangePassword) {
      await createSession({ userId: user.id, ipAddress, userAgent });
      return NextResponse.redirect(new URL('/dashboard/profile', request.url));
    }

    await createSession({
      userId: user.id,
      ipAddress,
      userAgent,
    });

    // Audit log
    await logAudit({
      action: AuditAction.OAUTH_LOGIN,
      userId: user.id,
      metadata: { provider, email: oauthUser.email },
      ipAddress,
      userAgent,
    });

    return NextResponse.redirect(new URL('/dashboard', request.url));

  } catch (error) {
    console.error(`OAuth ${provider} callback error:`, error);
    return NextResponse.redirect(new URL('/login?error=oauth_error', request.url));
  }
}
