'use server';

import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { withPermission, withAuth } from '@/lib/auth/wrapper';
import { logAudit, AuditAction } from '@/lib/audit';
import { getClientIp } from '@/lib/network';
import { detectImageType } from '@/lib/upload';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { TipoManutencao } from '@prisma/client';

const VALID_TIPOS: TipoManutencao[] = [
  'ABASTECIMENTO', 'TROCA_OLEO', 'ADITIVO', 'BATERIA', 'LIMPEZA', 'DEFEITO_AVARIA', 'OUTRO'
];

export type RegistroManutencaoWithDetails = {
  id: string;
  tipo: 'ABASTECIMENTO' | 'TROCA_OLEO' | 'ADITIVO' | 'BATERIA' | 'LIMPEZA' | 'DEFEITO_AVARIA' | 'OUTRO';
  dataHora: Date;
  responsavelId: string | null;
  quantidade: number | null;
  unidadeMedida: string | null;
  custo: number | null;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
  responsavel: { id: string; name: string } | null;
  anexos: { id: string; caminhoArquivo: string }[];
};

type ManutencaoInput = {
  tipo: string;
  dataHora: string;
  quantidade?: number;
  unidadeMedida?: string;
  custo?: number;
  observacoes?: string;
  anexoPaths?: string[];
};

function toDetails(registro: any): RegistroManutencaoWithDetails {
  return {
    ...registro,
    quantidade: registro.quantidade ? registro.quantidade.toNumber() : null,
    custo: registro.custo ? registro.custo.toNumber() : null,
  };
}

export const getManutencoes = withPermission('generator:read', async (session) => {
  const registros = await db.registroManutencao.findMany({
    orderBy: { dataHora: 'desc' },
    include: {
      responsavel: { select: { id: true, name: true } },
      anexos: { select: { id: true, caminhoArquivo: true } },
    },
  });
  return registros.map(toDetails);
});

export const createManutencao = withPermission('maintenance:create', async (session, data: ManutencaoInput) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  if (!VALID_TIPOS.includes(data.tipo as TipoManutencao)) {
    return { success: false, error: 'Tipo de manutenção inválido.' };
  }
  if (!data.dataHora) {
    return { success: false, error: 'Data/hora é obrigatória.' };
  }

  const registro = await db.registroManutencao.create({
    data: {
      tipo: data.tipo as TipoManutencao,
      dataHora: new Date(data.dataHora),
      responsavelId: session.user.id,
      quantidade: data.quantidade ?? null,
      unidadeMedida: data.unidadeMedida?.trim() || null,
      custo: data.custo ?? null,
      observacoes: data.observacoes?.trim() || null,
      anexos: data.anexoPaths && data.anexoPaths.length > 0
        ? { create: data.anexoPaths.map(caminhoArquivo => ({ caminhoArquivo })) }
        : undefined,
    },
    include: {
      responsavel: { select: { id: true, name: true } },
      anexos: { select: { id: true, caminhoArquivo: true } },
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditAction.MAINTENANCE_CREATE,
    metadata: { registroId: registro.id, tipo: registro.tipo },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true, registro: toDetails(registro) };
});

export const updateManutencao = withPermission('maintenance:update', async (session, id: string, data: ManutencaoInput) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  if (!VALID_TIPOS.includes(data.tipo as TipoManutencao)) {
    return { success: false, error: 'Tipo de manutenção inválido.' };
  }
  if (!data.dataHora) {
    return { success: false, error: 'Data/hora é obrigatória.' };
  }

  const registro = await db.registroManutencao.update({
    where: { id },
    data: {
      tipo: data.tipo as TipoManutencao,
      dataHora: new Date(data.dataHora),
      quantidade: data.quantidade ?? null,
      unidadeMedida: data.unidadeMedida?.trim() || null,
      custo: data.custo ?? null,
      observacoes: data.observacoes?.trim() || null,
      anexos: data.anexoPaths && data.anexoPaths.length > 0
        ? { create: data.anexoPaths.map(caminhoArquivo => ({ caminhoArquivo })) }
        : undefined,
    },
    include: {
      responsavel: { select: { id: true, name: true } },
      anexos: { select: { id: true, caminhoArquivo: true } },
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditAction.MAINTENANCE_UPDATE,
    metadata: { registroId: id, tipo: registro.tipo },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true, registro: toDetails(registro) };
});

export const deleteManutencao = withPermission('maintenance:delete', async (session, id: string) => {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get('user-agent') || 'unknown';

  const registro = await db.registroManutencao.findUnique({ where: { id } });
  if (!registro) {
    return { success: false, error: 'Registro não encontrado.' };
  }

  await db.registroManutencao.delete({ where: { id } });

  await logAudit({
    userId: session.user.id,
    action: AuditAction.MAINTENANCE_DELETE,
    metadata: { registroId: id, tipo: registro.tipo },
    ipAddress: ip,
    userAgent: ua,
  });

  return { success: true };
});

export const uploadAnexoManutencao = withAuth(async (session, formData: FormData) => {
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
  const uploadDir = join(publicDir, 'uploads', 'manutencoes');
  await mkdir(uploadDir, { recursive: true });

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const fileName = `${session.user.id}-${timestamp}-${randomSuffix}.${extension}`;
  const filePath = join(uploadDir, fileName);
  await writeFile(filePath, buffer);

  return { success: true, url: `/uploads/manutencoes/${fileName}` };
});
