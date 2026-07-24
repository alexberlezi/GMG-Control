import { headers } from 'next/headers';

/**
 * Tenta resolver a localização do IP usando Headers nativos (Cloudflare/Vercel)
 * ou caindo para uma API pública de GeoIP (ipapi.co suporta HTTPS).
 */
export async function resolveIpToLocation(ip: string | null | undefined): Promise<string | null> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return 'Local/Rede Privada';
  }

  // 1. Tentativa via Headers do Proxy (Cloudflare / Vercel)
  try {
    const reqHeaders = await headers();
    const city = reqHeaders.get('x-vercel-ip-city') || reqHeaders.get('cf-ipcity');
    const country = reqHeaders.get('x-vercel-ip-country') || reqHeaders.get('cf-ipcountry');
    
    if (city && country) {
      return `${city}, ${country}`;
    }
    if (country) return country;
  } catch (e) {
    // Falhou ao ler headers (contexto inválido)
  }

  // 2. Fallback: API Pública (ipapi.co suporta HTTPS no plano gratuito)
  try {
    const isIpv4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);
    const isIpv6 = /^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i.test(ip) || ip.includes('::');
    if (!isIpv4 && !isIpv6) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Timeout rápido para não travar o login

    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      next: { revalidate: 86400 } // Cache pesado para evitar rate limit
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    
    if (!data.error) {
      return `${data.city}, ${data.region} - ${data.country}`;
    }
  } catch (err) {
    console.error('[GeoIP Error]', err);
  }

  return null;
}
