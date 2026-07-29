import pg from 'pg';

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

// Filtrar temperatura inválida (32765 = overflow do sensor, < 34°C = fora de range)
const TEMPERATURA_INVALIDA = 32765;
const TEMPERATURA_MIN_VALIDA = 34;

function filtrarTemperatura(temp: number | null): number | null {
  if (temp === null) return null;
  if (temp === TEMPERATURA_INVALIDA) return null;
  if (temp < TEMPERATURA_MIN_VALIDA) return null;
  return temp;
}

// Colunas NUMERIC(x,y) do Postgres vêm como string do driver `pg` (evita perda de precisão
// silenciosa) — os campos abaixo tipados `string` precisam de Number(...) antes de qualquer
// conta ou .toFixed(). Campos SMALLINT/INTEGER (rpm, temperatura_c, combustivel_pct, partidas)
// já chegam como number. `time` (TIMESTAMPTZ) chega como Date.
export interface LeituraAtual {
  time: Date;
  modo_operacao: string;
  status_concessionaria: string;
  motor_status: string;
  rpm: number;
  temperatura_c: number | null;
  bateria_v: string;
  combustivel_pct: number;
  rede_freq_hz: string;
  rede_volts_l1: string;
  rede_volts_l2: string;
  rede_volts_l3: string;
  gerador_volts_l1: string;
  gerador_volts_l2: string;
  gerador_volts_l3: string;
  gerador_amps_l1: string;
  gerador_amps_l2: string;
  gerador_amps_l3: string;
  partidas: number;
  energia_kwh: string;
  energia_kvarh: string;
  energia_kvah: string;
  temperatura_invalida?: boolean; // Flag para avisar quando sensor está fora de serviço
}

export async function getUltimaLeitura(): Promise<LeituraAtual | null> {
  const { rows } = await geradorDb.query(
    `SELECT time, modo_operacao, status_concessionaria, motor_status, rpm, temperatura_c,
            bateria_v, combustivel_pct, rede_freq_hz, rede_volts_l1, rede_volts_l2, rede_volts_l3,
            gerador_volts_l1, gerador_volts_l2, gerador_volts_l3, gerador_amps_l1,
            gerador_amps_l2, gerador_amps_l3, partidas, energia_kwh, energia_kvarh, energia_kvah
     FROM leituras ORDER BY time DESC LIMIT 1`
  );

  const leitura = rows[0];
  if (!leitura) return null;

  // Marcar se temperatura é inválida e filtrar
  const tempOriginal = leitura.temperatura_c;
  leitura.temperatura_c = filtrarTemperatura(leitura.temperatura_c);
  leitura.temperatura_invalida = tempOriginal !== leitura.temperatura_c && tempOriginal !== null;

  return leitura;
}

// Largura do bucket por período — fixa, nunca calculada a partir de input do usuário. Mantém a
// quantidade de pontos do gráfico razoável (centenas, não milhares) em qualquer período.
const PERIODOS = {
  '6h': { bucket: '1 minute', janela: '6 hours' },
  '24h': { bucket: '5 minutes', janela: '24 hours' },
  '7d': { bucket: '1 hour', janela: '7 days' },
} as const;

export type Periodo = keyof typeof PERIODOS;

export const PERIODOS_VALIDOS = Object.keys(PERIODOS) as Periodo[];

export interface PontoHistorico {
  bucket: Date;
  rpm: number | null;
  temperatura_c: number | null;
  bateria_v: number | null;
}

export async function getHistoricoGerador(periodo: Periodo): Promise<PontoHistorico[]> {
  const { bucket, janela } = PERIODOS[periodo];
  const { rows } = await geradorDb.query(
    `SELECT time_bucket($1::interval, time) AS bucket,
            avg(rpm)::float8 AS rpm,
            avg(CASE
              WHEN temperatura_c = 32765 THEN NULL
              WHEN temperatura_c < 34 THEN NULL
              ELSE temperatura_c
            END)::float8 AS temperatura_c,
            avg(bateria_v)::float8 AS bateria_v
     FROM leituras
     WHERE time > now() - $2::interval
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [bucket, janela]
  );
  return rows;
}
