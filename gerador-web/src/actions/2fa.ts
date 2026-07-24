'use server';

import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth/wrapper';
import { encrypt, decrypt } from '@/lib/auth/secrets';
import { consumeTotp } from '@/lib/auth/totp';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { randomBytes, createHash } from 'crypto';
import argon2 from 'argon2';

import { rateLimitByAction } from '@/lib/auth/rate-limit';

export const generate2FASecret = withAuth(async (session, currentAuth?: string) => {
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return { success: false, error: 'Usuário não encontrado' };
  }

  // Security: Require re-authentication to rotate 2FA if they already have factors
  if (user.passwordHash || user.twoFactorEnabled) {
    if (!currentAuth) {
      return { success: false, error: 'Confirmação de segurança necessária (senha ou token atual).' };
    }

    const rateLimit = await rateLimitByAction('generate_2fa', user.id, 5, 900000);
    if (!rateLimit.allowed) {
      return { success: false, error: 'Muitas tentativas. Tente novamente mais tarde.' };
    }

    let authenticated = false;
    
    if (user.passwordHash) {
      authenticated = await argon2.verify(user.passwordHash, currentAuth).catch(() => false);
    }
    
    if (!authenticated && user.twoFactorEnabled && user.twoFactorSecret) {
      const secret = decrypt(user.twoFactorSecret);
      authenticated = await consumeTotp(user.id, secret, currentAuth);
    }

    if (!authenticated) {
      return { success: false, error: 'Confirmação incorreta.' };
    }
  }

  const rawSecret = new OTPAuth.Secret({ size: 20 });
  const secret = rawSecret.base32;
  const encryptedSecret = encrypt(secret);

  await db.user.update({
    where: { id: user.id },
    data: {
      twoFactorSecret: encryptedSecret,
      // We don't enable it until verified
    }
  });

  const totp = new OTPAuth.TOTP({
    issuer: 'AuthForge',
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: rawSecret
  });
  
  const otpauthUrl = totp.toString();
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { success: true, qrCodeDataUrl, secret }; // we can return secret for manual entry if needed
});

export const verifyAndEnable2FA = withAuth(async (session, token: string) => {
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.twoFactorSecret) {
    return { success: false, error: 'Segredo 2FA não gerado' };
  }

  const secret = decrypt(user.twoFactorSecret);
  const isValid = await consumeTotp(user.id, secret, token);

  if (!isValid) {
    return { success: false, error: 'Código inválido' };
  }

  // Generate 10 backup codes with 10 bytes of entropy each (20 hex chars)
  // Format: prefix(8) - secret(12)
  const rawCodes = Array.from({ length: 10 }, () => {
    const random = randomBytes(10).toString('hex');
    const prefix = random.substring(0, 8);
    const secret = random.substring(8);
    return { prefix, secret, raw: `${prefix}-${secret}` };
  });
  
  // Hash them for storage using Argon2id
  const hashedCodes = await Promise.all(
    rawCodes.map(async (code) => {
      // Reduced memory cost for backup codes to prevent DoS on generation, 
      // but prefix indexing prevents DoS on verification.
      const hash = await argon2.hash(code.secret, {
        type: argon2.argon2id,
        memoryCost: 15360, // 15 MB
        timeCost: 2,
        parallelism: 1
      });
      return { prefix: code.prefix, codeHash: hash, raw: code.raw };
    })
  );

  // Clear old backup codes and insert new ones
  await db.$transaction([
    db.backupCode.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true }
    }),
    db.backupCode.createMany({
      data: hashedCodes.map(c => ({
        userId: user.id,
        prefix: c.prefix,
        codeHash: c.codeHash
      }))
    })
  ]);

  return { success: true, backupCodes: hashedCodes.map(c => c.raw) };
});

export const disable2FA = withAuth(async (session, currentAuth: string) => {
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return { success: false, error: 'Conta inválida' };
  }

  const rateLimit = await rateLimitByAction('disable_2fa', user.id, 5, 900000);
  if (!rateLimit.allowed) {
    return { success: false, error: 'Muitas tentativas. Tente novamente mais tarde.' };
  }

  let authenticated = false;
  
  if (user.passwordHash) {
    authenticated = await argon2.verify(user.passwordHash, currentAuth).catch(() => false);
  }
  
  if (!authenticated && user.twoFactorEnabled && user.twoFactorSecret) {
    const secret = decrypt(user.twoFactorSecret);
    authenticated = await consumeTotp(user.id, secret, currentAuth);
  }

  if (!authenticated) {
    return { success: false, error: 'Confirmação incorreta.' };
  }

  await db.$transaction([
    db.backupCode.deleteMany({ where: { userId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    })
  ]);

  return { success: true };
});
