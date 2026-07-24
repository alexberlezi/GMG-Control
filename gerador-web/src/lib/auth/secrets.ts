import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(version: number): Buffer {
  const activeVersion = parseInt(process.env.AUTH_SECRET_VERSION || '1', 10);
  
  let envKey: string | undefined;
  if (version === activeVersion) {
    envKey = process.env.AUTH_SECRET;
  } else if (version === activeVersion - 1) {
    envKey = process.env.AUTH_SECRET_PREVIOUS;
  }

  if (!envKey) throw new Error(`Missing encryption key for version ${version}`);

  // Derive a 32-byte key from the secret
  return createHash('sha256').update(envKey).digest();
}

export function encrypt(plaintext: string, keyVersion?: number): string {
  const activeVersion = parseInt(process.env.AUTH_SECRET_VERSION || '1', 10);
  const version = keyVersion ?? activeVersion;

  const key = getEncryptionKey(version);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: version:iv:authTag:encrypted
  return `${version}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');

  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const [versionStr, ivHex, authTagHex, encrypted] = parts;
  const version = parseInt(versionStr, 10);

  const key = getEncryptionKey(version);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
