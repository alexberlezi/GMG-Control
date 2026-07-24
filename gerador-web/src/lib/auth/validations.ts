import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
  turnstileToken: z.string().optional(),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  passwordConfirm: z.string(),
  turnstileToken: z.string().optional(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Senhas não conferem',
  path: ['passwordConfirm'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
  turnstileToken: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Senhas não conferem',
  path: ['passwordConfirm'],
});

export const magicLinkSchema = z.object({
  email: z.string().email('Email inválido'),
  turnstileToken: z.string().optional(),
});

export const otpRequestSchema = z.object({
  email: z.string().email('Email inválido'),
  turnstileToken: z.string().optional(),
});

export const otpVerifySchema = z.object({
  email: z.string().email('Email inválido'),
  code: z.string().length(6, 'Código deve ter 6 dígitos'),
});

export const twoFactorVerifySchema = z.object({
  code: z.string().length(6, 'Código deve ter 6 dígitos'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres'),
  newPasswordConfirm: z.string(),
}).refine((data) => data.newPassword === data.newPasswordConfirm, {
  message: 'Senhas não conferem',
  path: ['newPasswordConfirm'],
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
});

export const inviteSchema = z.object({
  email: z.string().email('Email inválido'),
  roleId: z.string().min(1, 'Role é obrigatória'),
});

export const roleSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  permissions: z.array(z.string()),
});

export const setupSchema = z.object({
  // Step 1: Project
  projectName: z.string().min(2, 'Nome do projeto deve ter pelo menos 2 caracteres'),
  projectSlug: z.string().min(2, 'Slug deve ter pelo menos 2 caracteres'),

  // Step 2: Company
  companyName: z.string().optional(),
  companyCnpj: z.string().optional(),
  companyEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  companyPhone: z.string().optional(),

  // Step 3: Admin
  adminName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  adminEmail: z.string().email('Email inválido'),
  adminPassword: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),

  // Step 4: Visual
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
  defaultTheme: z.enum(['light', 'dark']),
  loginLayout: z.enum(['centered', 'split', 'minimal']),

  // Step 5: Email & Login
  emailProvider: z.enum(['resend', 'smtp']),
  emailApiKey: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  fromEmail: z.string().email('Email inválido'),
  fromName: z.string().optional(),

  // Auth methods
  emailPasswordEnabled: z.boolean().default(true),
  magicLinkEnabled: z.boolean().default(false),
  otpEnabled: z.boolean().default(false),

  // Turnstile
  turnstileEnabled: z.boolean().default(false),
  turnstileSiteKey: z.string().optional(),
  turnstileSecretKey: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type SetupInput = z.infer<typeof setupSchema>;
