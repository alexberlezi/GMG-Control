const { test, mock } = require('node:test');
const assert = require('node:assert');
const { executarCiclo } = require('../src/index');

test('executarCiclo grava a leitura quando a coleta funciona', async () => {
    const telemetriaFake = { time: '2026-07-24T12:00:00.000Z', rpm: 1500 };
    const deps = {
        pool: {},
        lerGeradorCompleto: mock.fn(async () => telemetriaFake),
        insertLeitura: mock.fn(async () => {}),
        insertFalha: mock.fn(async () => {})
    };

    await executarCiclo(deps);

    assert.strictEqual(deps.insertLeitura.mock.calls.length, 1);
    assert.strictEqual(deps.insertLeitura.mock.calls[0].arguments[1], telemetriaFake);
    assert.strictEqual(deps.insertFalha.mock.calls.length, 0);
});

test('executarCiclo grava falha e não relança o erro quando a coleta falha', async () => {
    const deps = {
        pool: {},
        lerGeradorCompleto: mock.fn(async () => { throw new Error('timeout no endereço 1536'); }),
        insertLeitura: mock.fn(async () => {}),
        insertFalha: mock.fn(async () => {})
    };

    await assert.doesNotReject(() => executarCiclo(deps));

    assert.strictEqual(deps.insertLeitura.mock.calls.length, 0);
    assert.strictEqual(deps.insertFalha.mock.calls.length, 1);
    assert.strictEqual(deps.insertFalha.mock.calls[0].arguments[1], 'timeout no endereço 1536');
});

test('executarCiclo não relança mesmo se insertFalha também falhar', async () => {
    const deps = {
        pool: {},
        lerGeradorCompleto: mock.fn(async () => { throw new Error('timeout'); }),
        insertLeitura: mock.fn(async () => {}),
        insertFalha: mock.fn(async () => { throw new Error('conexão com banco perdida'); })
    };

    await assert.doesNotReject(() => executarCiclo(deps));
});
