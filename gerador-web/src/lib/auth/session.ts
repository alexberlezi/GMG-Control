import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';
import { db } from '@/lib/db';
import { UAParser } from 'ua-parser-js';
import { resolveIpToLocation } from './geoip';
import { sendEmail } from '@/lib/email/send';
import { newDeviceAlertTemplate } from '@/lib/email/templates';
import { AuditAction } from '@/lib/audit';

const SESSION_COOKIE = 'session_token';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseUserAgent(userAgentString: string | null): {
  deviceName: string;
  deviceType: string;
} {
  if (!userAgentString) {
    return { deviceName: 'Dispositivo desconhecido', deviceType: 'unknown' };
  }

  const parser = new UAParser(userAgentString);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  const deviceName = [browser.name, 'no', os.name].filter(Boolean).join(' ') || 'Desconhecido';
  let deviceType = 'desktop';

  if (device.type === 'mobile') deviceType = 'mobile';
  else if (device.type === 'tablet') deviceType = 'tablet';

  return { deviceName, deviceType };
}

export async function createSession(params: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  maxAge?: number;
}): Promise<string> {
  const {
    userId,
    ipAddress,
    userAgent,
    maxAge = SESSION_MAX_AGE,
  } = params;

  const rawToken = randomBytes(32).toString('hex');
  const hashedToken = hashSessionToken(rawToken);
  const { deviceName, deviceType } = parseUserAgent(userAgent ?? null);

  // 1. Resolve Location
  const location = await resolveIpToLocation(ipAddress);

  // 2. Fetch User to get name and check for new device
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true }
  });

  // 3. Check if device/IP is new (heuristic: have we seen this UserAgent before for this user?)
  let isNewDevice = false;
  if (user) {
    const previousLogins = await db.auditLog.findFirst({
      where: {
        userId,
        action: { in: [AuditAction.LOGIN_SUCCESS, AuditAction.OAUTH_LOGIN] },
        userAgent: userAgent ?? ''
      }
    });

    // Se não encontrou ocorrência anterior deste Navegador (e não é o primeiro login do usuário), é um dispositivo novo.
    if (!previousLogins) {
      const anyLogin = await db.auditLog.findFirst({ 
        where: { 
          userId, 
          action: { in: [AuditAction.LOGIN_SUCCESS, AuditAction.OAUTH_LOGIN] } 
        } 
      });
      if (anyLogin) {
        isNewDevice = true;
      }
    }
  }

  // 4. Create Session
  await db.session.create({
    data: {
      userId,
      token: hashedToken,
      ipAddress,
      location,
      userAgent,
      deviceName,
      deviceType,
      expiresAt: new Date(Date.now() + maxAge * 1000),
    },
  });

  // 5. Dispatch Alerts asynchronously (fire and forget)
  if (isNewDevice && user && user.email) {
    const timeStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const locStr = location || 'Localização Desconhecida';
    const devStr = deviceName || 'Dispositivo Desconhecido';
    
    // In-App Notification
    db.notification.create({
      data: {
        userId,
        title: 'Novo Acesso Detectado',
        message: `Sua conta foi acessada por um dispositivo não reconhecido (${devStr}) em ${locStr}.`,
        type: 'WARNING'
      }
    }).catch(console.error);

    // Email Alert
    sendEmail({
      to: user.email,
      subject: 'Alerta de Segurança: Novo Acesso Detectado',
      html: newDeviceAlertTemplate(user.name, locStr, devStr, timeStr)
    }).catch(console.error);
  }

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, rawToken, {
    ...COOKIE_OPTIONS,
    maxAge,
  });

  // Mark system as installed
  cookieStore.set('kit_installed', 'true', {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
  });

  return rawToken;
}

export async function validateSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!rawToken) return null;

  const hashedToken = hashSessionToken(rawToken);

  const session = await db.session.findUnique({
    where: { token: hashedToken },
    include: {
      user: {
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } });
    return null;
  }
  if (!session.user.isActive) return null;

  // Update lastActiveAt (debounced: only if > 5 min since last update)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (session.lastActiveAt < fiveMinutesAgo) {
    await db.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });
  }

  return session;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    const hashedToken = hashSessionToken(rawToken);
    await db.session.deleteMany({ where: { token: hashedToken } });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function revokeSession(sessionId: string, currentSessionToken?: string) {
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session) return false;

  // Prevent revoking current session
  if (currentSessionToken) {
    const currentHash = hashSessionToken(currentSessionToken);
    if (session.token === currentHash) return false;
  }

  await db.session.delete({ where: { id: sessionId } });
  return true;
}

export async function revokeAllSessions(userId: string, exceptSessionToken?: string) {
  if (exceptSessionToken) {
    const currentHash = hashSessionToken(exceptSessionToken);
    await db.session.deleteMany({
      where: {
        userId,
        token: { not: currentHash },
      },
    });
  } else {
    await db.session.deleteMany({ where: { userId } });
  }
}

export async function getUserSessions(userId: string) {
  return db.session.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      deviceName: true,
      deviceType: true,
      ipAddress: true,
      createdAt: true,
      lastActiveAt: true,
    },
    orderBy: { lastActiveAt: 'desc' },
  });
}

export type SessionWithUser = NonNullable<Awaited<ReturnType<typeof validateSession>>>;
