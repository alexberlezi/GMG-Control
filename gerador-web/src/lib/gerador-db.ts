import pg from 'pg';

export interface LeituraAtual {
  time: Date;
  modo_operacao: string | null;
  status_concessionaria: string | null;
  motor_status: string | null;
  rpm: number | null;
  temperatura: number | null;
  temperatura_invalida: boolean;
  bateria_v: number | null;
  nivel_combustivel: number | null;
  rede_freq_hz: number | null;
  rede_volts_l1: number | null;
  rede_volts_l2: number | null;
  rede_volts_l3: number | null;
  gerador_volts_l1: number | null;
  gerador_volts_l2: number | null;
  gerador_volts_l3: number | null;
  gerador_amps_l1: number | null;
  gerador_amps_l2: number | null;
  gerador_amps_l3: number | null;
  partidas: number | null;
  energia_kwh: number | null;
  energia_kvarh: number | null;
  energia_kvah: number | null;
}

export interface HistoricoGeradorPonto {
  tempo: Date;
  temperatura: number | null;
  rpm: number | null;
  combustivel: number | null;
}

export type Periodo = '24h' | '7d' | '30d' | '90d';
export const PERIODOS_VALIDOS: Periodo[] = ['24h', '7d', '30d', '90d'];

const globalForGeradorDb = globalThis as unknown as {
  geradorDbPool: pg.Pool | undefined;
};

function createGeradorDbPool() {
  return new pg.Pool({
    host: process.env.GERADOR_DB_HOST,
    port: Number(process.env.GERADOR_DB_PORT || 5432),
    database: process.env.GERADOR_DB_NAME,
    user: process.env.GERADOR_DB_USER,
    password: process.env.GERADOR_DB_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export const geradorDb = globalForGeradorDb.geradorDbPool ?? createGeradorDbPool();

if (process.env.NODE_ENV !== 'production') {
  globalForGeradorDb.geradorDbPool = geradorDb;
}

function isTemperaturaValida(temp: number | null): boolean {
  if (temp === null) return false;
  // Valores inválidos: 32765 (INT16 overflow), 32767 (INT16 max), 65535 (UINT16 overflow), < 34°C (sensor range limit)
  return !(temp === 32765 || temp === 32767 || temp === 65535 || temp < 34);
}

export async function getUltimaLeitura(): Promise<LeituraAtual | null> {
  const { rows } = await geradorDb.query(
    `SELECT time, modo_operacao, status_concessionaria, motor_status, rpm, temperatura_c,
            bateria_v, combustivel_pct, rede_freq_hz, rede_volts_l1, rede_volts_l2, rede_volts_l3,
            gerador_volts_l1, gerador_volts_l2, gerador_volts_l3, gerador_amps_l1,
            gerador_amps_l2, gerador_amps_l3, partidas, energia_kwh, energia_kvarh, energia_kvah
     FROM leituras ORDER BY time DESC LIMIT 1`
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  const temperatura = row.temperatura_c;
  const temperaduraValida = isTemperaturaValida(temperatura);

  return {
    time: new Date(row.time),
    modo_operacao: row.modo_operacao,
    status_concessionaria: row.status_concessionaria,
    motor_status: row.motor_status,
    rpm: row.rpm,
    temperatura: temperaduraValida ? temperatura : null,
    temperatura_invalida: !temperaduraValida,
    bateria_v: row.bateria_v,
    nivel_combustivel: row.combustivel_pct,
    rede_freq_hz: row.rede_freq_hz,
    rede_volts_l1: row.rede_volts_l1,
    rede_volts_l2: row.rede_volts_l2,
    rede_volts_l3: row.rede_volts_l3,
    gerador_volts_l1: row.gerador_volts_l1,
    gerador_volts_l2: row.gerador_volts_l2,
    gerador_volts_l3: row.gerador_volts_l3,
    gerador_amps_l1: row.gerador_amps_l1,
    gerador_amps_l2: row.gerador_amps_l2,
    gerador_amps_l3: row.gerador_amps_l3,
    partidas: row.partidas,
    energia_kwh: row.energia_kwh,
    energia_kvarh: row.energia_kvarh,
    energia_kvah: row.energia_kvah,
  };
}

export async function getHistoricoGerador(periodo: Periodo): Promise<HistoricoGeradorPonto[]> {
  const periodoMap = {
    '24h': '1 day',
    '7d': '7 days',
    '30d': '30 days',
    '90d': '90 days',
  };

  const interval = periodoMap[periodo];

  const { rows } = await geradorDb.query(
    `
    WITH tempo_bucketed AS (
      SELECT
        time_bucket('5 minutes', time) AS bucket,
        AVG(NULLIF(temperatura_c, 32765)) AS temperatura,
        AVG(rpm) AS rpm,
        AVG(combustivel_pct) AS combustivel
      FROM leituras
      WHERE time > NOW() - INTERVAL '${interval}'
        AND temperatura_c NOT IN (32765, 32767, 65535)
        AND temperatura_c >= 34
      GROUP BY bucket
    )
    SELECT
      bucket AS tempo,
      temperatura,
      rpm,
      combustivel
    FROM tempo_bucketed
    ORDER BY tempo ASC
    `
  );

  return rows.map((row) => ({
    tempo: new Date(row.tempo),
    temperatura: row.temperatura ? Math.round(row.temperatura * 10) / 10 : null,
    rpm: row.rpm ? Math.round(row.rpm) : null,
    combustivel: row.combustivel ? Math.round(row.combustivel) : null,
  }));
}
