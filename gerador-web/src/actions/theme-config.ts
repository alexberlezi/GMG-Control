'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/auth/wrapper';
import { z } from 'zod';

const ThemeConfigSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  projectName: z.string().optional(),
  companyName: z.string().nullable().optional(),
  companyCnpj: z.string().nullable().optional(),
  companyEmail: z.string().nullable().optional(),
  companyPhone: z.string().nullable().optional(),
  logoLightUrl: z.string().nullable().optional(),
  logoDarkUrl: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  loginLayout: z.string().optional(),
  defaultTheme: z.string().optional(),
  loginPillText: z.string().nullable().optional(),
  loginTitleText: z.string().nullable().optional(),
  loginSubtitleText: z.string().nullable().optional(),
}).strict();

const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
function sanitizeColor(color: string, defaultColor: string): string {
  if (!color || !hexRegex.test(color)) return defaultColor;
  return color;
}

// Pública: Usada pelo Root Layout
export async function getThemeConfig() {
  try {
    let config = await db.themeConfig.findFirst();
    if (config) {
      config.primaryColor = sanitizeColor(config.primaryColor, '#3B82F6');
      config.secondaryColor = sanitizeColor(config.secondaryColor, '#22C55E');
      config.accentColor = sanitizeColor(config.accentColor, '#0EA5E9');
    }
    return config;
  } catch (error) {
    console.error('Error fetching theme config:', error);
    return null;
  }
}

export const updateThemeConfig = withAuth(async (session, data: any) => {
  try {
    if (!session.user.isOwner) {
      return { success: false, error: 'Acesso negado. Apenas proprietários podem alterar a aparência.' };
    }

    // Validate colors (XSS protection)
    const colorFields = [
      { key: 'primaryColor', default: '#3B82F6' },
      { key: 'secondaryColor', default: '#22C55E' },
      { key: 'accentColor', default: '#0EA5E9' }
    ];

    const parsed = ThemeConfigSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: 'Dados inválidos.' };
    }
    const validData = parsed.data as any;

    for (const field of colorFields) {
      if (validData[field.key]) {
        if (!hexRegex.test(validData[field.key])) {
          return { success: false, error: `Cor inválida para ${field.key}. Use formato HEX.` };
        }
      }
    }

    const currentConfig = await db.themeConfig.findFirst();

    if (!currentConfig) {
      await db.themeConfig.create({
        data: { ...validData, id: 'default' },
      });
    } else {
      await db.themeConfig.update({
        where: { id: currentConfig.id },
        data: validData,
      });
    }

    revalidatePath('/', 'layout');
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating theme config:', error);
    return { success: false, error: error.message || 'Falha interna ao atualizar as configurações de aparência.' };
  }
});
