import { prisma } from '@/lib/prisma';
import { getUltimaLeitura } from '@/lib/gerador-db';

/**
 * Sistema de detecção de alarmes para o gerador
 * Verifica dados de telemetria e cria alarmes automáticos
 */

interface AlarmeConfig {
  tipo: string;
  titulo: string;
  descricao: string;
  nivel: 'CRITICO' | 'AVISO' | 'INFO';
  condicao: (leitura: any) => boolean;
  valor?: (leitura: any) => number | null;
  unidade?: string;
}

const ALARMES_CONFIG: AlarmeConfig[] = [
  // Temperatura
  {
    tipo: 'TEMPERATURA_ALTA',
    titulo: 'Temperatura Elevada',
    descricao: 'Temperatura do gerador acima do limite seguro (>85°C)',
    nivel: 'CRITICO',
    condicao: (l) => l.temperatura !== null && l.temperatura > 85,
    valor: (l) => l.temperatura,
    unidade: '°C',
  },
  {
    tipo: 'TEMPERATURA_SENSOR_ERRO',
    titulo: 'Sensor de Temperatura Fora de Operação',
    descricao: 'Sensor de temperatura não está retornando valores válidos',
    nivel: 'CRITICO',
    condicao: (l) => l.temperatura_invalida === true,
  },

  // Combustível
  {
    tipo: 'COMBUSTIVEL_BAIXO',
    titulo: 'Nível de Combustível Baixo',
    descricao: 'Combustível abaixo de 20% da capacidade',
    nivel: 'AVISO',
    condicao: (l) => l.nivel_combustivel !== null && l.nivel_combustivel < 20,
    valor: (l) => l.nivel_combustivel,
    unidade: '%',
  },
  {
    tipo: 'COMBUSTIVEL_BAIXO',
    titulo: 'Nível de Combustível Crítico',
    descricao: 'Combustível abaixo de 5% da capacidade - risco de interrupção',
    nivel: 'CRITICO',
    condicao: (l) => l.nivel_combustivel !== null && l.nivel_combustivel < 5,
    valor: (l) => l.nivel_combustivel,
    unidade: '%',
  },

  // Bateria
  {
    tipo: 'BATERIA_BAIXA',
    titulo: 'Tensão de Bateria Baixa',
    descricao: 'Tensão da bateria abaixo de 24V (limite mínimo)',
    nivel: 'AVISO',
    condicao: (l) => l.bateria_v !== null && l.bateria_v < 24,
    valor: (l) => l.bateria_v,
    unidade: 'V',
  },

  // Frequência
  {
    tipo: 'FREQUENCIA_FORA_ESPECIFICACAO',
    titulo: 'Frequência Fora da Especificação',
    descricao: 'Frequência da rede fora do intervalo 59-61 Hz',
    nivel: 'AVISO',
    condicao: (l) => l.rede_freq_hz !== null && (l.rede_freq_hz < 59 || l.rede_freq_hz > 61),
    valor: (l) => l.rede_freq_hz,
    unidade: 'Hz',
  },

  // Tensão Rede
  {
    tipo: 'TENSAO_REDE_FORA_ESPECIFICACAO',
    titulo: 'Tensão da Rede Fora da Especificação',
    descricao: 'Tensão da rede fora do intervalo 220V ±10% (198-242V)',
    nivel: 'AVISO',
    condicao: (l) => {
      if (!l.rede_volts_l1 || !l.rede_volts_l2 || !l.rede_volts_l3) return false;
      const media = (l.rede_volts_l1 + l.rede_volts_l2 + l.rede_volts_l3) / 3;
      return media < 198 || media > 242;
    },
    valor: (l) => {
      if (!l.rede_volts_l1 || !l.rede_volts_l2 || !l.rede_volts_l3) return null;
      return Math.round((l.rede_volts_l1 + l.rede_volts_l2 + l.rede_volts_l3) / 3);
    },
    unidade: 'V',
  },

  // Tensão Gerador
  {
    tipo: 'TENSAO_GERADOR_FORA_ESPECIFICACAO',
    titulo: 'Tensão do Gerador Fora da Especificação',
    descricao: 'Tensão de saída do gerador fora da especificação (220V ±10%)',
    nivel: 'CRITICO',
    condicao: (l) => {
      if (!l.gerador_volts_l1 || !l.gerador_volts_l2 || !l.gerador_volts_l3) return false;
      const media = (l.gerador_volts_l1 + l.gerador_volts_l2 + l.gerador_volts_l3) / 3;
      return media < 198 || media > 242;
    },
    valor: (l) => {
      if (!l.gerador_volts_l1 || !l.gerador_volts_l2 || !l.gerador_volts_l3) return null;
      return Math.round((l.gerador_volts_l1 + l.gerador_volts_l2 + l.gerador_volts_l3) / 3);
    },
    unidade: 'V',
  },

  // Corrente Alta
  {
    tipo: 'CORRENTE_ALTA',
    titulo: 'Corrente de Saída Elevada',
    descricao: 'Corrente de saída acima de 90A - aproximando do limite máximo',
    nivel: 'AVISO',
    condicao: (l) => {
      if (!l.gerador_amps_l1 || !l.gerador_amps_l2 || !l.gerador_amps_l3) return false;
      const media = (l.gerador_amps_l1 + l.gerador_amps_l2 + l.gerador_amps_l3) / 3;
      return media > 90;
    },
    valor: (l) => {
      if (!l.gerador_amps_l1 || !l.gerador_amps_l2 || !l.gerador_amps_l3) return null;
      return Math.round((l.gerador_amps_l1 + l.gerador_amps_l2 + l.gerador_amps_l3) / 3 * 10) / 10;
    },
    unidade: 'A',
  },

  // Falha de Rede
  {
    tipo: 'FALHA_REDE',
    titulo: 'Rede da Concessionária Indisponível',
    descricao: 'Rede de distribuição ausente - gerador operando em modo ilhado',
    nivel: 'INFO',
    condicao: (l) => l.status_concessionaria !== 'Disponível',
  },
];

/**
 * Verifica dados de telemetria e cria alarmes automáticos se necessário
 */
export async function detectarAlarmes(): Promise<void> {
  try {
    const leitura = await getUltimaLeitura();
    if (!leitura) {
      console.log('[AlarmeDetector] Nenhuma leitura disponível');
      return;
    }

    // Verificar cada alarme configurado
    for (const alarmeConfig of ALARMES_CONFIG) {
      // Verificar se a condição é atendida
      if (!alarmeConfig.condicao(leitura)) {
        continue;
      }

      // Verificar se já existe alarme não resolvido deste tipo
      const alarmeExistente = await prisma.alarmeGerador.findFirst({
        where: {
          tipo: alarmeConfig.tipo as any,
          resolvido: false,
        },
        orderBy: {
          acionadoEm: 'desc',
        },
      });

      // Se existe alarme recente (menos de 5 minutos), não criar novo
      if (
        alarmeExistente &&
        Date.now() - alarmeExistente.acionadoEm.getTime() < 5 * 60 * 1000
      ) {
        continue;
      }

      // Criar novo alarme
      try {
        await prisma.alarmeGerador.create({
          data: {
            tipo: alarmeConfig.tipo as any,
            nivel: alarmeConfig.nivel as any,
            titulo: alarmeConfig.titulo,
            descricao: alarmeConfig.descricao,
            valor: alarmeConfig.valor ? alarmeConfig.valor(leitura) : null,
            unidade: alarmeConfig.unidade || null,
            acionadoEm: new Date(),
          },
        });

        console.log(`[AlarmeDetector] Alarme criado: ${alarmeConfig.titulo}`);
      } catch (error) {
        console.error(`[AlarmeDetector] Erro ao criar alarme ${alarmeConfig.tipo}:`, error);
      }
    }
  } catch (error) {
    console.error('[AlarmeDetector] Erro ao detectar alarmes:', error);
  }
}

/**
 * Resolve alarmes automáticos quando as condições retornam à normalidade
 */
export async function resolverAlarmesAutomaticamente(): Promise<void> {
  try {
    const leitura = await getUltimaLeitura();
    if (!leitura) {
      return;
    }

    // Buscar todos os alarmes não resolvidos
    const alarmesAbertos = await prisma.alarmeGerador.findMany({
      where: {
        resolvido: false,
      },
    });

    for (const alarme of alarmesAbertos) {
      // Encontrar a configuração do alarme
      const config = ALARMES_CONFIG.find((a) => a.tipo === alarme.tipo);
      if (!config) continue;

      // Se a condição não é mais atendida, resolver o alarme
      if (!config.condicao(leitura)) {
        try {
          await prisma.alarmeGerador.update({
            where: { id: alarme.id },
            data: {
              resolvido: true,
              resolvidoEm: new Date(),
              notas: 'Resolvido automaticamente - condição normalizada',
            },
          });

          console.log(`[AlarmeDetector] Alarme resolvido: ${alarme.titulo}`);
        } catch (error) {
          console.error(`[AlarmeDetector] Erro ao resolver alarme:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[AlarmeDetector] Erro ao resolver alarmes:', error);
  }
}
