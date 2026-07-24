// gerador-monitor/src/db.js
function criarPool() {
    const { Pool } = require('pg');
    return new Pool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });
}

async function insertLeitura(pool, telemetria) {
    await pool.query(
        `INSERT INTO leituras (
            time, modo_operacao, status_concessionaria, motor_status, rpm, temperatura_c,
            bateria_v, combustivel_pct, rede_freq_hz, rede_volts_l1, rede_volts_l2, rede_volts_l3,
            gerador_volts_l1, gerador_volts_l2, gerador_volts_l3, gerador_amps_l1,
            gerador_amps_l2, gerador_amps_l3, partidas, energia_kwh, energia_kvarh, energia_kvah
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
            telemetria.time, telemetria.modo_operacao, telemetria.status_concessionaria,
            telemetria.motor_status, telemetria.rpm, telemetria.temperatura_c, telemetria.bateria_v,
            telemetria.combustivel_pct, telemetria.rede_freq_hz, telemetria.rede_volts_l1,
            telemetria.rede_volts_l2, telemetria.rede_volts_l3, telemetria.gerador_volts_l1,
            telemetria.gerador_volts_l2, telemetria.gerador_volts_l3, telemetria.gerador_amps_l1,
            telemetria.gerador_amps_l2, telemetria.gerador_amps_l3, telemetria.partidas,
            telemetria.energia_kwh, telemetria.energia_kvarh, telemetria.energia_kvah
        ]
    );
}

async function insertFalha(pool, mensagemErro, agora = new Date()) {
    await pool.query(
        `INSERT INTO falhas_coleta (time, erro) VALUES ($1, $2)`,
        [agora.toISOString(), mensagemErro]
    );
}

module.exports = { criarPool, insertLeitura, insertFalha };
