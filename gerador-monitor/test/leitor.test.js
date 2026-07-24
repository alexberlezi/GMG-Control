// gerador-monitor/test/leitor.test.js
const { test, mock } = require('node:test');
const assert = require('node:assert');
const { decodificarTelemetria, lerRegistradoresBrutos, lerGeradorCompleto } = require('../src/leitor');

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

function clientFake(respostasPorEndereco, { falharEm } = {}) {
    return {
        setTimeout: mock.fn(),
        connectTCP: mock.fn(async () => {}),
        setID: mock.fn(),
        close: mock.fn(),
        readHoldingRegisters: mock.fn(async (endereco, quantidade) => {
            if (falharEm === endereco) {
                throw new Error(`timeout no endereço ${endereco}`);
            }
            return respostasPorEndereco[endereco];
        })
    };
}

const respostasValidas = {
    768: { data: [1] },
    1024: { data: [1500, 0, 75, 80, 0, 135] },
    1061: { data: [1270, 0, 1270, 0, 1270] },
    1536: { buffer: Buffer.alloc(24) },
    1799: { data: [6000, 0, 1200, 0, 0, 0, 500, 0, 300, 0, 42] }
};

test('lerRegistradoresBrutos lê os 5 blocos nos endereços corretos', async () => {
    const client = clientFake(respostasValidas);

    const blocos = await lerRegistradoresBrutos(client);

    assert.strictEqual(client.readHoldingRegisters.mock.calls.length, 5);
    assert.deepStrictEqual(client.readHoldingRegisters.mock.calls[0].arguments, [768, 1]);
    assert.deepStrictEqual(client.readHoldingRegisters.mock.calls[1].arguments, [1024, 6]);
    assert.deepStrictEqual(client.readHoldingRegisters.mock.calls[2].arguments, [1061, 5]);
    assert.deepStrictEqual(client.readHoldingRegisters.mock.calls[3].arguments, [1536, 12]);
    assert.deepStrictEqual(client.readHoldingRegisters.mock.calls[4].arguments, [1799, 11]);
    assert.strictEqual(blocos.regStatus, respostasValidas[768]);
    assert.strictEqual(blocos.regGerador, respostasValidas[1536]);
});

test('lerGeradorCompleto conecta, seta slave ID, decodifica e fecha a conexão', async () => {
    const client = clientFake(respostasValidas);
    const config = { ip: '10.40.10.111', porta: 502, slaveId: 10 };

    const telemetria = await lerGeradorCompleto(config, client);

    assert.strictEqual(client.connectTCP.mock.calls[0].arguments[0], '10.40.10.111');
    assert.deepStrictEqual(client.connectTCP.mock.calls[0].arguments[1], { port: 502 });
    assert.strictEqual(client.setID.mock.calls[0].arguments[0], 10);
    assert.strictEqual(client.close.mock.calls.length, 1);
    assert.strictEqual(telemetria.rpm, 1500);
});

test('lerGeradorCompleto fecha a conexão mesmo quando a leitura falha, e propaga o erro', async () => {
    const client = clientFake(respostasValidas, { falharEm: 1536 });
    const config = { ip: '10.40.10.111', porta: 502, slaveId: 10 };

    await assert.rejects(
        () => lerGeradorCompleto(config, client),
        /timeout no endereço 1536/
    );
    assert.strictEqual(client.close.mock.calls.length, 1);
});
