import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { validateSession } from '@/lib/auth/session';
import { detectImageType } from '@/lib/upload';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session || !session.user.isOwner) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null; // 'logo-light' | 'logo-dark' | 'favicon'

    if (!file || !type) {
      return NextResponse.json({ error: 'Arquivo e tipo são obrigatórios' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido. Use PNG, JPG, WebP ou ICO (SVG desabilitado por segurança).' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 2MB.' }, { status: 400 });
    }

    const validTypes = ['logo-light', 'logo-dark', 'favicon'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Determine exact file extension from magic bytes, rejecting SVG entirely
    const extension = detectImageType(buffer);
    if (!extension) {
      return NextResponse.json({ error: 'Arquivo corrompido ou malicioso (magic bytes inválido)' }, { status: 400 });
    }

    const filename = `${type}.${extension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'branding');
    await mkdir(uploadDir, { recursive: true });
    
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const url = `/uploads/branding/${filename}`;

    return NextResponse.json({ url, filename });
  } catch (error) {
    console.error('[Upload] Failed:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
  }
}
