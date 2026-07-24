// gerador-monitor/test/db.test.js
const { test, mock } = require('node:test');
const assert = require('node:assert');
const { insertLeitura, insertFalha } = require('../src/db');

function telemetriaFake() {
    return {
        time: '2026-07-24T12:00:00.000Z',
        modo_operacao: 'Automático',
        status_concessionaria: 'Rede OK',
        motor_status: 'Rodando',
        rpm: 1500,
        temperatura_c: 75,
        bateria_v: 13.5,
        combustivel_pct: 80,
        rede_freq_hz: 60,
        rede_volts_l1: 127,
        rede_volts_l2: 127,
        rede_volts_l3: 127,
        gerador_volts_l1: 230,
        gerador_volts_l2: 231,
        gerador_volts_l3: 229,
        gerador_amps_l1: 15,
        gerador_amps_l2: 14.8,
        gerador_amps_l3: 15.2,
        partidas: 42,
        energia_kwh: 120,
        energia_kvarh: 30,
        energia_kvah: 50
    };
}

function poolFake() {
    return { query: mock.fn(async () => ({ rowCount: 1 })) };
}

test('insertLeitura grava todas as 22 colunas de leituras na ordem esperada', async () => {
    const pool = poolFake();
    const telemetria = telemetriaFake();

    await insertLeitura(pool, telemetria);

    assert.strictEqual(pool.query.mock.calls.length, 1);
    const [sql, params] = pool.query.mock.calls[0].arguments;
    assert.match(sql, /INSERT INTO leituras/);
    assert.strictEqual(params.length, 22);
    assert.deepStrictEqual(params, [
        telemetria.time, telemetria.modo_operacao, telemetria.status_concessionaria,
        telemetria.motor_status, telemetria.rpm, telemetria.temperatura_c, telemetria.bateria_v,
        telemetria.combustivel_pct, telemetria.rede_freq_hz, telemetria.rede_volts_l1,
        telemetria.rede_volts_l2, telemetria.rede_volts_l3, telemetria.gerador_volts_l1,
        telemetria.gerador_volts_l2, telemetria.gerador_volts_l3, telemetria.gerador_amps_l1,
        telemetria.gerador_amps_l2, telemetria.gerador_amps_l3, telemetria.partidas,
        telemetria.energia_kwh, telemetria.energia_kvarh, telemetria.energia_kvah
    ]);
});

test('insertLeitura preserva temperatura_c null (sensor ausente)', async () => {
    const pool = poolFake();
    const telemetria = telemetriaFake();
    telemetria.temperatura_c = null;

    await insertLeitura(pool, telemetria);

    const [, params] = pool.query.mock.calls[0].arguments;
    assert.strictEqual(params[5], null);
});

test('insertFalha grava o timestamp e a mensagem de erro em falhas_coleta', async () => {
    const pool = poolFake();
    const agora = new Date('2026-07-24T12:05:00.000Z');

    await insertFalha(pool, 'timeout no endereço 1536', agora);

    assert.strictEqual(pool.query.mock.calls.length, 1);
    const [sql, params] = pool.query.mock.calls[0].arguments;
    assert.match(sql, /INSERT INTO falhas_coleta/);
    assert.deepStrictEqual(params, ['2026-07-24T12:05:00.000Z', 'timeout no endereço 1536']);
});
