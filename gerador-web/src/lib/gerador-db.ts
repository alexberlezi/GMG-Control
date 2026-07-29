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

export async function getUltimaLeitura() {
  const { rows } = await geradorDb.query(
    `SELECT time, modo_operacao, status_concessionaria, motor_status, rpm, temperatura_c,
            bateria_v, combustivel_pct, rede_freq_hz, rede_volts_l1, rede_volts_l2, rede_volts_l3,
            gerador_volts_l1, gerador_volts_l2, gerador_volts_l3, gerador_amps_l1,
            gerador_amps_l2, gerador_amps_l3, partidas, energia_kwh, energia_kvarh, energia_kvah
     FROM leituras ORDER BY time DESC LIMIT 1`
  );
  return rows[0] ?? null;
}
