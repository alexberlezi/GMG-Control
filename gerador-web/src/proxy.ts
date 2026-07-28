import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES_EXACT = [
  '/login',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/verify', // Moved from prefix
  '/setup',
  '/auth/2fa',
];

const PUBLIC_ROUTES_PREFIX = [
  '/invite/',
  '/api/auth/',
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES_EXACT.includes(pathname)) return true;
  return PUBLIC_ROUTES_PREFIX.some((route) => pathname.startsWith(route));
}

const STATIC_EXTENSIONS = [
  '.ico', '.png', '.jpg', '.jpeg', '.webp', '.svg',
  '.css', '.js', '.woff', '.woff2', '.ttf', '.eot',
  '.json', '.xml', '.txt', '.mp4', '.webm'
];

function isStaticAsset(pathname: string): boolean {
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/_next')) return true;
  
  return STATIC_EXTENSIONS.some(ext => pathname.toLowerCase().endsWith(ext));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Application handles setup redirect using DB checks in layout/pages,
  // so we don't need a cookie-based edge guard here anymore.

  // Apply security headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  // Generate CSP Nonce
  const nonce = btoa(crypto.randomUUID());
  requestHeaders.set('x-nonce', nonce);

  // CSP: allow fonts from googleapis/gstatic
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: http: ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https:;
    font-src 'self' https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  // Next.js extracts nonce automatically when CSP is in requestHeaders
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', cspHeader);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // HSTS only makes sense over a real HTTPS connection — sending it over
  // plain HTTP (e.g. local dev, or before a reverse proxy adds TLS) tells
  // the browser to refuse http:// for this origin for up to 2 years,
  // breaking every subsequent request until the browser's HSTS cache for
  // the host is manually cleared. `x-forwarded-proto` covers the case
  // where a reverse proxy (e.g. Nginx Proxy Manager) terminates TLS in
  // front of this app.
  const isHttps =
    request.nextUrl.protocol === 'https:' ||
    requestHeaders.get('x-forwarded-proto') === 'https';
  if (isHttps) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains'
    );
  }

  // Public routes — no auth required
  if (isPublicRoute(pathname)) {
    return response;
  }

  // Protected routes — verify session token exists
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
