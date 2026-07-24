import { db } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { logAudit, AuditAction } from '@/lib/audit';
import { headers, cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/network';
import { validateVerificationToken } from '@/lib/auth/tokens';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
  }

  try {
    const verification = await validateVerificationToken({ token, type: 'MAGIC_LINK' });

    if (!verification) {
      return NextResponse.redirect(new URL('/login?error=expired_token', request.url));
    }

    // Find user
    const user = verification.userId
      ? await db.user.findUnique({ where: { id: verification.userId } })
      : await db.user.findUnique({ where: { email: verification.email } });

    if (!user || !user.isActive) {
      return NextResponse.redirect(new URL('/login?error=account_inactive', request.url));
    }

    const headersList = await headers();
    const ipAddress = getClientIp(headersList);
    const userAgent = headersList.get('user-agent') || 'unknown';

    // 2FA Check
    if (user.twoFactorEnabled) {
      const { SignJWT } = await import('jose');
      const { getSecret } = await import('@/lib/auth/tokens');
      const jwtSecret = getSecret();
      const preAuthToken = await new SignJWT({ userId: user.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('5m')
        .sign(jwtSecret);

      const cookieStore = await cookies();
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

    // Create session (this sets the cookie internally)
    await createSession({
      userId: user.id,
      ipAddress,
      userAgent,
    });

    // Audit log
    await logAudit({
      action: AuditAction.MAGIC_LINK_VERIFY,
      userId: user.id,
      metadata: { email: user.email, method: 'magic_link' },
      ipAddress,
      userAgent,
    });

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));

  } catch (error) {
    console.error('Magic Link Verify Error:', error);
    return NextResponse.redirect(new URL('/login?error=internal', request.url));
  }
}
