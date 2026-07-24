import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(params: {
  key: string;
  maxAttempts: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const { key, maxAttempts, windowMs } = params;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  // Limpeza oportunista (10% de chance) para evitar crescimento infinito da tabela
  if (Math.random() < 0.1) {
    await db.$executeRaw`DELETE FROM "RateLimit" WHERE "expiresAt" < ${now}`;
  }

  // PostgreSQL Atomic Upsert
  const query = Prisma.sql`
    INSERT INTO "RateLimit" ("key", "points", "expiresAt")
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "points" = CASE 
        WHEN "RateLimit"."expiresAt" < ${now} THEN 1
        ELSE "RateLimit"."points" + 1
      END,
      "expiresAt" = CASE 
        WHEN "RateLimit"."expiresAt" < ${now} THEN ${expiresAt}
        ELSE "RateLimit"."expiresAt"
      END
    RETURNING "points", "expiresAt";
  `;

  const result: any[] = await db.$queryRaw(query);
  const row = result[0];

  const currentPoints = row.points;
  const currentExpiresAt = row.expiresAt;

  if (currentPoints > maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: currentExpiresAt };
  }

  return { allowed: true, remaining: maxAttempts - currentPoints, resetAt: currentExpiresAt };
}

export async function rateLimitByIP(ip: string, maxAttempts = 10, windowMs = 60000): Promise<RateLimitResult> {
  return checkRateLimit({ key: `ip:${ip}`, maxAttempts, windowMs });
}

export async function rateLimitByEmail(email: string, maxAttempts = 5, windowMs = 900000): Promise<RateLimitResult> {
  return checkRateLimit({ key: `email:${email.toLowerCase()}`, maxAttempts, windowMs });
}

export async function rateLimitByAction(action: string, identifier: string, maxAttempts = 3, windowMs = 60000): Promise<RateLimitResult> {
  return checkRateLimit({ key: `${action}:${identifier}`, maxAttempts, windowMs });
}
