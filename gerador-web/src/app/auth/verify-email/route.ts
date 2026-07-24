import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateVerificationToken } from '@/lib/auth/tokens';
import { logAudit, AuditAction } from '@/lib/audit';
import { getClientIp } from '@/lib/network';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
  }

  try {
    const record = await validateVerificationToken({
      token,
      type: 'EMAIL_CHANGE'
    });

    if (!record || !record.userId) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
    }

    // Check if email is already in use
    const existingUser = await db.user.findUnique({
      where: { email: record.email }
    });

    if (existingUser) {
      return NextResponse.redirect(new URL('/login?error=email_taken', request.url));
    }

    // Update user's email
    await db.user.update({
      where: { id: record.userId },
      data: { email: record.email }
    });

    const ipAddress = getClientIp(request.headers);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logAudit({
      userId: record.userId,
      action: AuditAction.USER_UPDATE,
      metadata: { field: 'email', newEmail: record.email },
      ipAddress,
      userAgent
    });

    return NextResponse.redirect(new URL('/dashboard/profile?success=email_updated', request.url));
  } catch (error) {
    console.error('Error verifying email change token:', error);
    return NextResponse.redirect(new URL('/login?error=verification_failed', request.url));
  }
}
