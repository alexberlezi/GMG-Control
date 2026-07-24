// gerador-monitor/test/leitor.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { decodificarTelemetria } = require('../src/leitor');

function blocosPadrao(overrides = {}) {
    const buffer = Buffer.alloc(24);
    buffer.writeUInt32BE(2300, 0);   // gerador_volts_l1 = 230.0
    buffer.writeUInt32BE(2310, 4);   // gerador_volts_l2 = 231.0
    buffer.writeUInt32BE(2290, 8);   // gerador_volts_l3 = 229.0
    buffer.writeUInt32BE(150, 12);   // gerador_amps_l1 = 15.0
    buffer.writeUInt32BE(148, 16);   // gerador_amps_l2 = 14.8
    buffer.writeUInt32BE(152, 20);   // gerador_amps_l3 = 15.2

    return {
        regStatus: { data: [1] },                                   // Automático
        regMotor: { data: [1500, 0, 75, 80, 0, 135] },               // rpm, _, temp, comb, _, bateria*10
        regRede: { data: [1270, 0, 1270, 0, 1270] },                 // L1,_,L2,_,L3 (x10)
        regGerador: { buffer },
        regStats: { data: [6000, 0, 1200, 0, 0, 0, 500, 0, 300, 0, 42] },
        ...overrides
    };
}

test('decodifica uma leitura normal com todos os sensores presentes', () => {
    const agora = new Date('2026-07-24T12:00:00.000Z');
    const telemetria = decodificarTelemetria(blocosPadrao(), agora);

    assert.strictEqual(telemetria.time, '2026-07-24T12:00:00.000Z');
    assert.strictEqual(telemetria.modo_operacao, 'Automático');
    assert.strictEqual(telemetria.status_concessionaria, 'Rede OK');
    assert.strictEqual(telemetria.motor_status, 'Rodando');
    assert.strictEqual(telemetria.rpm, 1500);
    assert.strictEqual(telemetria.temperatura_c, 75);
    assert.strictEqual(telemetria.bateria_v, 13.5);
    assert.strictEqual(telemetria.combustivel_pct, 80);
    assert.strictEqual(telemetria.rede_freq_hz, 60);
    assert.strictEqual(telemetria.rede_volts_l1, 127);
    assert.strictEqual(telemetria.gerador_volts_l1, 230);
    assert.strictEqual(telemetria.gerador_amps_l3, 15.2);
    assert.strictEqual(telemetria.partidas, 42);
    assert.strictEqual(telemetria.energia_kwh, 120);
    assert.strictEqual(telemetria.energia_kvah, 50);
    assert.strictEqual(telemetria.energia_kvarh, 30);
});

test('sensor de temperatura ausente (32767) vira null', () => {
    const blocos = blocosPadrao({ regMotor: { data: [1500, 0, 32767, 80, 0, 135] } });
    const telemetria = decodificarTelemetria(blocos);
    assert.strictEqual(telemetria.temperatura_c, null);
});

test('sensor de temperatura ausente (65535) vira null', () => {
    const blocos = blocosPadrao({ regMotor: { data: [1500, 0, 65535, 80, 0, 135] } });
    const telemetria = decodificarTelemetria(blocos);
    assert.strictEqual(telemetria.temperatura_c, null);
});

test('rpm 65535 (sem leitura) vira 0 e status motor Parado', () => {
    const blocos = blocosPadrao({ regMotor: { data: [65535, 0, 75, 80, 0, 135] } });
    const telemetria = decodificarTelemetria(blocos);
    assert.strictEqual(telemetria.rpm, 0);
    assert.strictEqual(telemetria.motor_status, 'Parado');
});

test('combustivel 65535 (sem leitura) vira 0', () => {
    const blocos = blocosPadrao({ regMotor: { data: [1500, 0, 75, 65535, 0, 135] } });
    const telemetria = decodificarTelemetria(blocos);
    assert.strictEqual(telemetria.combustivel_pct, 0);
});

test('tensao de rede abaixo de 100V em L1 ou L2 indica falha na rede', () => {
    const blocos = blocosPadrao({ regRede: { data: [900, 0, 1270, 0, 1270] } });
    const telemetria = decodificarTelemetria(blocos);
    assert.strictEqual(telemetria.status_concessionaria, 'FALHA NA REDE');
});

test('codigo de modo desconhecido mantem texto Desconhecido', () => {
    const blocos = blocosPadrao({ regStatus: { data: [9] } });
    const telemetria = decodificarTelemetria(blocos);
    assert.strictEqual(telemetria.modo_operacao, 'Desconhecido');
});
