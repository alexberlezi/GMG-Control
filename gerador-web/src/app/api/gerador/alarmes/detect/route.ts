import { NextRequest, NextResponse } from 'next/server';
import { detectarAlarmes, resolverAlarmesAutomaticamente } from '@/lib/alarme-detector';

/**
 * POST /api/gerador/alarmes/detect
 *
 * Detecta e cria alarmes automáticos baseado nos dados de telemetria
 * Pode ser chamado periodicamente por um job/cron
 *
 * Requer header: X-API-Key (para segurança)
 */
export async function POST(request: NextRequest) {
  try {
    // Validar API key
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey !== process.env.GERADOR_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Detectar novos alarmes
    await detectarAlarmes();

    // Resolver alarmes que voltaram à normalidade
    await resolverAlarmesAutomaticamente();

    return NextResponse.json(
      { success: true, message: 'Alarmes detectados e processados' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Erro ao detectar alarmes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gerador/alarmes/detect
 *
 * Health check - verifica se a API está respondendo
 */
export async function GET() {
  return NextResponse.json(
    { status: 'ok', message: 'API de detecção de alarmes ativa' },
    { status: 200 }
  );
}
