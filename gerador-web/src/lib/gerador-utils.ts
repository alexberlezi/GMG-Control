import { prisma } from '@/lib/prisma';

export interface DashboardSummary {
  ultimoAbastecimento: {
    data: Date;
    quantidade: number | null;
    unidade: string | null;
    observacoes: string | null;
  } | null;
  ultimaManutencao: {
    tipo: string;
    data: Date;
    observacoes: string | null;
  } | null;
  alarmesCriticos: number;
  alarmesAvisos: number;
  totalCombustivel: number | null;
}

export interface AlarmeCard {
  id: string;
  tipo: string;
  nivel: 'CRITICO' | 'AVISO' | 'INFO';
  titulo: string;
  descricao: string | null;
  valor: number | null;
  unidade: string | null;
  acionadoEm: Date;
  resolvido: boolean;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    // Buscar último abastecimento
    const ultimoAbastecimento = await prisma.registroManutencao.findFirst({
      where: {
        tipo: 'ABASTECIMENTO',
      },
      orderBy: {
        dataHora: 'desc',
      },
      select: {
        dataHora: true,
        quantidade: true,
        unidadeMedida: true,
        observacoes: true,
      },
    });

    // Buscar última manutenção (qualquer tipo)
    const ultimaManutencao = await prisma.registroManutencao.findFirst({
      orderBy: {
        dataHora: 'desc',
      },
      select: {
        tipo: true,
        dataHora: true,
        observacoes: true,
      },
    });

    // Buscar alarmes críticos e avisos não resolvidos
    const alarmesCriticos = await prisma.alarmeGerador.count({
      where: {
        nivel: 'CRITICO',
        resolvido: false,
      },
    });

    const alarmesAvisos = await prisma.alarmeGerador.count({
      where: {
        nivel: 'AVISO',
        resolvido: false,
      },
    });

    // TODO: Buscar total de combustível disponível (será integrado com banco de gerador telemetria)
    const totalCombustivel = null;

    return {
      ultimoAbastecimento: ultimoAbastecimento ? {
        data: ultimoAbastecimento.dataHora,
        quantidade: ultimoAbastecimento.quantidade ? Number(ultimoAbastecimento.quantidade) : null,
        unidade: ultimoAbastecimento.unidadeMedida,
        observacoes: ultimoAbastecimento.observacoes,
      } : null,
      ultimaManutencao: ultimaManutencao ? {
        tipo: ultimaManutencao.tipo,
        data: ultimaManutencao.dataHora,
        observacoes: ultimaManutencao.observacoes,
      } : null,
      alarmesCriticos,
      alarmesAvisos,
      totalCombustivel,
    };
  } catch (error) {
    console.error('Erro ao buscar summary do dashboard:', error);
    return {
      ultimoAbastecimento: null,
      ultimaManutencao: null,
      alarmesCriticos: 0,
      alarmesAvisos: 0,
      totalCombustivel: null,
    };
  }
}

export async function getAlarmes(filtro?: {
  nivel?: 'CRITICO' | 'AVISO' | 'INFO';
  resolvido?: boolean;
  limite?: number;
}): Promise<AlarmeCard[]> {
  try {
    const alarmes = await prisma.alarmeGerador.findMany({
      where: {
        nivel: filtro?.nivel,
        resolvido: filtro?.resolvido,
      },
      orderBy: {
        acionadoEm: 'desc',
      },
      take: filtro?.limite || 50,
    });

    return alarmes.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      nivel: a.nivel as 'CRITICO' | 'AVISO' | 'INFO',
      titulo: a.titulo,
      descricao: a.descricao,
      valor: a.valor ? Number(a.valor) : null,
      unidade: a.unidade,
      acionadoEm: a.acionadoEm,
      resolvido: a.resolvido,
    }));
  } catch (error) {
    console.error('Erro ao buscar alarmes:', error);
    return [];
  }
}

export async function criarAlarme(dados: {
  tipo: string;
  nivel: 'CRITICO' | 'AVISO' | 'INFO';
  titulo: string;
  descricao?: string;
  valor?: number;
  unidade?: string;
}): Promise<AlarmeCard | null> {
  try {
    const alarme = await prisma.alarmeGerador.create({
      data: {
        tipo: dados.tipo as any,
        nivel: dados.nivel,
        titulo: dados.titulo,
        descricao: dados.descricao,
        valor: dados.valor ? dados.valor : null,
        unidade: dados.unidade,
        acionadoEm: new Date(),
      },
    });

    return {
      id: alarme.id,
      tipo: alarme.tipo,
      nivel: alarme.nivel as 'CRITICO' | 'AVISO' | 'INFO',
      titulo: alarme.titulo,
      descricao: alarme.descricao,
      valor: alarme.valor ? Number(alarme.valor) : null,
      unidade: alarme.unidade,
      acionadoEm: alarme.acionadoEm,
      resolvido: alarme.resolvido,
    };
  } catch (error) {
    console.error('Erro ao criar alarme:', error);
    return null;
  }
}

export async function resolverAlarme(id: string, notas?: string): Promise<boolean> {
  try {
    await prisma.alarmeGerador.update({
      where: { id },
      data: {
        resolvido: true,
        resolvidoEm: new Date(),
        notas,
      },
    });
    return true;
  } catch (error) {
    console.error('Erro ao resolver alarme:', error);
    return false;
  }
}
