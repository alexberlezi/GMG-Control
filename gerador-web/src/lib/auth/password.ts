import argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function validatePasswordStrength(
  password: string,
  options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireNumber?: boolean;
    requireSpecialChar?: boolean;
  } = {},
): { valid: boolean; errors: string[] } {
  const {
    minLength = 8,
    requireUppercase = true,
    requireNumber = true,
    requireSpecialChar = false,
  } = options;

  const errors: string[] = [];

  if (password.length < minLength) {
    errors.push(`Mínimo de ${minLength} caracteres`);
  }
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Deve conter pelo menos uma letra maiúscula');
  }
  if (requireNumber && !/[0-9]/.test(password)) {
    errors.push('Deve conter pelo menos um número');
  }
  if (requireSpecialChar && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Deve conter pelo menos um caractere especial');
  }

  return { valid: errors.length === 0, errors };
}
