'use server';

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { withAuth, withPermission } from '@/lib/auth/wrapper';

import { detectImageType } from '@/lib/upload';

export const uploadBrandingImage = withAuth(async (session, formData: FormData) => {
  if (!session.user.isOwner) {
    return { success: false, error: 'Sem permissão.' };
  }

  const file = formData.get('file') as File;
  const type = formData.get('type') as string;

  if (!file) {
    return { success: false, error: 'Nenhum arquivo enviado.' };
  }

  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'O arquivo deve ser uma imagem.' };
  }
  if (file.size > 5 * 1024 * 1024) { 
    return { success: false, error: 'A imagem deve ter no máximo 5MB.' };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const extension = detectImageType(buffer);
  if (!extension) {
    return { success: false, error: 'Arquivo inválido ou não suportado (apenas imagens reais são permitidas, SVG desabilitado).' };
  }

  const publicDir = join(process.cwd(), 'public');
  const uploadDir = join(publicDir, 'uploads', 'branding');
  
  await mkdir(uploadDir, { recursive: true });
  const timestamp = Date.now();
  const fileName = `${type}-${timestamp}.${extension}`;
  const filePath = join(uploadDir, fileName);

  await writeFile(filePath, buffer);

  const publicUrl = `/uploads/branding/${fileName}`;

  return { success: true, url: publicUrl };
});

export const uploadAvatarImage = withAuth(async (session, formData: FormData) => {
  const file = formData.get('file') as File;

  if (!file) {
    return { success: false, error: 'Nenhum arquivo enviado.' };
  }

  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'O arquivo deve ser uma imagem.' };
  }
  if (file.size > 5 * 1024 * 1024) { 
    return { success: false, error: 'A imagem deve ter no máximo 5MB.' };
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const extension = detectImageType(buffer);
  if (!extension) {
    return { success: false, error: 'Arquivo inválido ou não suportado (apenas imagens reais são permitidas, SVG desabilitado).' };
  }

  const publicDir = join(process.cwd(), 'public');
  const uploadDir = join(publicDir, 'uploads', 'avatars');
  
  await mkdir(uploadDir, { recursive: true });
  const timestamp = Date.now();
  const fileName = `${session.user.id}-${timestamp}.${extension}`;
  const filePath = join(uploadDir, fileName);

  await writeFile(filePath, buffer);

  const publicUrl = `/uploads/avatars/${fileName}`;

  return { success: true, url: publicUrl };
});
