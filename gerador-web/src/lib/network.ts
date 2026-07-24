/**
 * Extrai o IP real do cliente, prevenindo spoofing do cabeçalho X-Forwarded-For.
 * 
 * Por padrão, o X-Forwarded-For cresce da esquerda para a direita.
 * O cliente inicial (ou atacante) controla o primeiro IP. O proxy confiável adiciona
 * o IP de quem se conectou a ele no final da lista. 
 * Portanto, com 1 proxy confiável, o IP real é o ÚLTIMO da lista.
 */
export function getClientIp(headersList: Headers): string {
  const trustedProxiesCount = parseInt(process.env.TRUSTED_PROXIES_COUNT || '0', 10);

  if (trustedProxiesCount === 0) {
    // Sem proxy configurado. Como o Next.js App Router não expõe o request.ip no headers(),
    // e X-Forwarded-For não é confiável, retornamos 'unknown' para evitar spoofing.
    return 'unknown';
  }

  const forwardedFor = headersList.get('x-forwarded-for');
  
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim()).filter(Boolean);
    if (ips.length > 0) {
      // Pega o n-ésimo IP a partir do final
      const index = Math.max(0, ips.length - trustedProxiesCount);
      return ips[index];
    }
  }

  // Fallback se não houver cabeçalho
  return 'unknown';
}
