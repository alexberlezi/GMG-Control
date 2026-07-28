import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

// Next.js's built-in public/ file serving only recognizes files that existed
// when the production server started — files added at runtime (uploads) 404
// until the process restarts. This route reads uploaded files from disk on
// every request instead, so newly uploaded files are served immediately.
// Route Handlers take priority over the public/ folder fallback, so this
// transparently replaces static serving for everything under /uploads/.

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  if (segments.some((segment) => segment === '..' || segment.includes('/') || segment.includes('\\'))) {
    return NextResponse.json({ error: 'Caminho inválido' }, { status: 400 });
  }

  const baseDir = path.join(process.cwd(), 'public', 'uploads');
  const filePath = path.join(baseDir, ...segments);

  if (!filePath.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: 'Caminho inválido' }, { status: 400 });
  }

  const extension = path.extname(filePath).slice(1).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return NextResponse.json({ error: 'Tipo de arquivo não suportado' }, { status: 400 });
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }
    const buffer = await readFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=0',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
  }
}
