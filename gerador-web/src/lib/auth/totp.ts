import * as OTPAuth from 'otpauth';
import { db } from '@/lib/db';

export async function consumeTotp(userId: string, secretBase32: string, code: string): Promise<boolean> {
  const totp = new OTPAuth.TOTP({
    issuer: 'AuthForge',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32)
  });
  
  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) return false;

  const currentPeriod = Math.floor(Date.now() / 1000 / 30);
  const absoluteCounter = currentPeriod + delta;

  const result = await db.user.updateMany({
    where: { 
      id: userId,
      twoFactorLastCounter: { lt: absoluteCounter }
    },
    data: {
      twoFactorLastCounter: absoluteCounter
    }
  });

  return result.count > 0;
}
