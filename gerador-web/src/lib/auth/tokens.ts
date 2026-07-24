import { SignJWT, jwtVerify } from 'jose';
import { randomBytes, createHash } from 'crypto';
import { db } from '@/lib/db';

export const getSecret = () => {
  if (!process.env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET is not configured. The application cannot start safely.');
  }
  return new TextEncoder().encode(process.env.AUTH_SECRET);
};

// ═══════════════════════════════════════
// JWT Tokens (Short-lived — ADR-001)
// ═══════════════════════════════════════

interface TokenPayload {
  email: string;
  type: string;
  [key: string]: unknown;
}

export async function createSignedToken(
  payload: TokenPayload,
  expiresIn: string = '15m',
): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(randomBytes(16).toString('hex'))
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());

  return token;
}

export async function verifySignedToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as TokenPayload;
  } catch {
    // Also try previous secret for rotation
    const previousSecret = process.env.AUTH_SECRET_PREVIOUS;
    if (previousSecret) {
      try {
        const prevKey = new TextEncoder().encode(previousSecret);
        const { payload } = await jwtVerify(token, prevKey);
        return payload as unknown as TokenPayload;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ═══════════════════════════════════════
// Verification Tokens (DB-backed, single-use)
// ═══════════════════════════════════════

type TokenType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'MAGIC_LINK' | 'OTP_CODE' | 'EMAIL_CHANGE' | 'INVITE';

const TOKEN_EXPIRY: Record<TokenType, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,  // 24h
  PASSWORD_RESET: 60 * 60 * 1000,            // 1h
  MAGIC_LINK: 15 * 60 * 1000,               // 15min
  OTP_CODE: 10 * 60 * 1000,                 // 10min
  EMAIL_CHANGE: 24 * 60 * 60 * 1000,        // 24h
  INVITE: 7 * 24 * 60 * 60 * 1000,          // 7 days
};

export async function createVerificationToken(params: {
  email: string;
  type: TokenType;
  userId?: string;
}): Promise<string> {
  const { email, type, userId } = params;

  // Invalidate previous tokens of same type/email
  await db.verificationToken.updateMany({
    where: { email, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = type === 'OTP_CODE'
    ? generateOTPCode()
    : randomBytes(32).toString('hex');

  const hashedToken = createHash('sha256').update(rawToken).digest('hex');

  await db.verificationToken.create({
    data: {
      userId,
      email,
      token: hashedToken,
      type,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY[type]),
    },
  });

  return rawToken;
}

export async function validateVerificationToken(params: {
  token: string;
  type: TokenType;
}): Promise<{ email: string; userId: string | null } | null> {
  const { token, type } = params;

  const hashedToken = createHash('sha256').update(token).digest('hex');

  const record = await db.verificationToken.findFirst({
    where: {
      token: hashedToken,
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) return null;

  // Mark as used (single-use)
  await db.verificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return { email: record.email, userId: record.userId };
}

export async function peekVerificationToken(params: {
  token: string;
  type: TokenType;
}): Promise<{ email: string; userId: string | null } | null> {
  const { token, type } = params;

  const hashedToken = createHash('sha256').update(token).digest('hex');

  const record = await db.verificationToken.findFirst({
    where: {
      token: hashedToken,
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) return null;

  // DOES NOT consume the token!
  return { email: record.email, userId: record.userId };
}

function generateOTPCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

// Cleanup expired tokens
export async function cleanupExpiredTokens() {
  await db.verificationToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { usedAt: { not: null }, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });
}
