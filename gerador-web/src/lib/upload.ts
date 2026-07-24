// Magic bytes validator for common images (SVG intentionally excluded for XSS safety)
export function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  const hex = buffer.toString('hex', 0, 4).toLowerCase();

  // JPEG
  if (hex.startsWith('ffd8')) return 'jpg';
  // PNG
  if (hex === '89504e47') return 'png';
  // GIF
  if (hex === '47494638') return 'gif';
  // WebP
  if (hex === '52494646' && buffer.length >= 12) {
    const webp = buffer.toString('hex', 8, 12).toLowerCase();
    if (webp === '57454250') return 'webp';
  }
  // ICO (00 00 01 00)
  if (hex === '00000100') return 'ico';
  
  return null;
}
