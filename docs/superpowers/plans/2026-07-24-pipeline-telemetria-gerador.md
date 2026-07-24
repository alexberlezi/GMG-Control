# Pipeline de Telemetria do Gerador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o script de leitura pontual `gerador-monitor/index.js` num worker de coleta
contínua que lê o gerador via Modbus TCP a cada 10s e grava o histórico num TimescaleDB, pronto
para o Grafana consultar.

**Architecture:** Worker Node.js (CommonJS, sem ORM) dividido em três módulos com responsabilidade
única — `leitor.js` (Modbus: leitura bruta + decodificação pura), `db.js` (Postgres/TimescaleDB via
`pg`), `index.js` (loop de coleta) — empacotado em Docker junto com um container TimescaleDB.

**Tech Stack:** Node.js 20, `modbus-serial`, `pg`, `node:test` (runner nativo, sem dependência
extra de teste), Docker + Docker Compose, TimescaleDB (`timescale/timescaledb:latest-pg16`).

## Global Constraints

- IP do gateway: `10.40.10.111`, porta `502` (Modbus TCP), Slave ID `10` — configurável via env,
  não hardcoded.
- Intervalo de coleta: 10 segundos, configurável via `INTERVALO_MS`.
- Falha de leitura Modbus → grava em `falhas_coleta`, loga o erro, e **não derruba o worker**.
- Sensores ausentes (registrador retorna `32767` ou `65535`) → salvar como `null`.
- Tensões/correntes do gerador: blocos de 32 bits, Big-Endian (`readUInt32BE`).
- Acumulados de energia (kWh/kVAh/kvarh): blocos de 16 bits simples.
- Sem ORM — apenas `pg` com queries parametrizadas.
- Retention policy: 90 dias nas tabelas `leituras` e `falhas_coleta`.
- Todo valor de configuração (IP, credenciais, intervalo) vem de variáveis de ambiente, nunca
  hardcoded no código.

---

### Task 1: Decodificação pura da telemetria (`leitor.js` — parte 1)

**Files:**
- Create: `gerador-monitor/src/leitor.js`
- Test: `gerador-monitor/test/leitor.test.js`

**Interfaces:**
- Produces: `decodificarTelemetria(blocos, agora = new Date())` — função pura. `blocos` é
  `{ regStatus, regMotor, regRede, regGerador, regStats }`, onde `regStatus`/`regMotor`/`regRede`/
  `regStats` têm o formato `{ data: number[] }` e `regGerador` tem o formato `{ buffer: Buffer }`
  (mesmo shape retornado por `client.readHoldingRegisters()` da lib `modbus-serial`). Retorna um
  objeto plano com todas as colunas de `leituras` (ver spec), incluindo `time` (ISO string).

- [ ] **Step 1: Escrever os testes da decodificação**

```javascript
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
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `cd gerador-monitor && npx --no-install node --test test/leitor.test.js` (ou apenas
`node --test test/leitor.test.js` de dentro de `gerador-monitor/`)
Expected: FAIL — `Cannot find module '../src/leitor'`

- [ ] **Step 3: Implementar `decodificarTelemetria`**

```javascript
// gerador-monitor/src/leitor.js
function decodificarTelemetria({ regStatus, regMotor, regRede, regGerador, regStats }, agora = new Date()) {
    const codModo = regStatus.data[0];
    let modoOperacao = "Desconhecido";
    if (codModo === 0) modoOperacao = "Parado (Stop)";
    if (codModo === 1) modoOperacao = "Automático";
    if (codModo === 2) modoOperacao = "Manual";
    if (codModo === 3) modoOperacao = "Teste";

    let rpmMotor = regMotor.data[0];
    if (rpmMotor === 65535) rpmMotor = 0;

    const temperatura = regMotor.data[2];
    const temperaturaC = (temperatura === 32767 || temperatura === 65535) ? null : temperatura;

    let combustivel = regMotor.data[3];
    if (combustivel === 65535) combustivel = 0;

    const bateriaV = regMotor.data[5] / 10;

    const redeL1 = regRede.data[0] / 10;
    const redeL2 = regRede.data[2] / 10;
    const redeL3 = regRede.data[4] / 10;
    const statusConcessionaria = (redeL1 > 100 && redeL2 > 100) ? "Rede OK" : "FALHA NA REDE";

    const genVoltsL1 = regGerador.buffer.readUInt32BE(0) / 10;
    const genVoltsL2 = regGerador.buffer.readUInt32BE(4) / 10;
    const genVoltsL3 = regGerador.buffer.readUInt32BE(8) / 10;
    const genAmpL1 = regGerador.buffer.readUInt32BE(12) / 10;
    const genAmpL2 = regGerador.buffer.readUInt32BE(16) / 10;
    const genAmpL3 = regGerador.buffer.readUInt32BE(20) / 10;

    const freqRede = regStats.data[0] / 100;
    const energiaKwh = regStats.data[2] / 10;
    const energiaKvah = regStats.data[6] / 10;
    const energiaKvarh = regStats.data[8] / 10;
    const numPartidas = regStats.data[10];

    return {
        time: agora.toISOString(),
        modo_operacao: modoOperacao,
        status_concessionaria: statusConcessionaria,
        motor_status: rpmMotor > 0 ? "Rodando" : "Parado",
        rpm: rpmMotor,
        temperatura_c: temperaturaC,
        bateria_v: bateriaV,
        combustivel_pct: combustivel,
        rede_freq_hz: freqRede,
        rede_volts_l1: redeL1,
        rede_volts_l2: redeL2,
        rede_volts_l3: redeL3,
        gerador_volts_l1: genVoltsL1,
        gerador_volts_l2: genVoltsL2,
        gerador_volts_l3: genVoltsL3,
        gerador_amps_l1: genAmpL1,
        gerador_amps_l2: genAmpL2,
        gerador_amps_l3: genAmpL3,
        partidas: numPartidas,
        energia_kwh: energiaKwh,
        energia_kvarh: energiaKvarh,
        energia_kvah: energiaKvah
    };
}

module.exports = { decodificarTelemetria };
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `cd gerador-monitor && node --test test/leitor.test.js`
Expected: PASS — 7 testes passando

- [ ] **Step 5: Commit**

```bash
git add gerador-monitor/src/leitor.js gerador-monitor/test/leitor.test.js
git commit -m "feat: decodificação pura da telemetria do DSE 4520 MKII"
```

---

### Task 2: Leitura Modbus (bruta + wrapper de conexão) (`leitor.js` — parte 2)

**Files:**
- Modify: `gerador-monitor/src/leitor.js`
- Test: `gerador-monitor/test/leitor.test.js`

**Interfaces:**
- Consumes: `decodificarTelemetria(blocos, agora)` de Task 1.
- Produces:
  - `lerRegistradoresBrutos(client)` — recebe um client com o método
    `readHoldingRegisters(endereco, quantidade)` (interface do `modbus-serial`), faz as 5 leituras
    (768/1, 1024/6, 1061/5, 1536/12, 1799/11) e retorna
    `{ regStatus, regMotor, regRede, regGerador, regStats }`.
  - `lerGeradorCompleto(config, client = new ModbusRTU())` — `config` é
    `{ ip, porta, slaveId }`. Conecta, seta timeout de 3000ms e o slave ID, chama
    `lerRegistradoresBrutos`, decodifica com `decodificarTelemetria`, sempre fecha a conexão
    (`client.close()`) mesmo em erro, e propaga qualquer erro para o chamador.

- [ ] **Step 1: Escrever os testes de `lerRegistradoresBrutos` e `lerGeradorCompleto`**

Adicionar ao final de `gerador-monitor/test/leitor.test.js`:

```javascript
const { test, mock } = require('node:test');
// (ajustar o require do topo do arquivo para incluir `mock`:)
// const { test, mock } = require('node:test');
const { lerRegistradoresBrutos, lerGeradorCompleto } = require('../src/leitor');

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
```

Também ajustar o topo do arquivo de teste para importar `mock` de `node:test` (uma única linha
`const { test, mock } = require('node:test');`, substituindo o `require` original do Step 1 da
Task 1).

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `cd gerador-monitor && node --test test/leitor.test.js`
Expected: FAIL — `lerRegistradoresBrutos is not a function` / `lerGeradorCompleto is not a function`

- [ ] **Step 3: Implementar `lerRegistradoresBrutos` e `lerGeradorCompleto`**

Adicionar ao topo e ao final de `gerador-monitor/src/leitor.js`:

```javascript
// no topo do arquivo, antes de decodificarTelemetria:
const ModbusRTU = require("modbus-serial");

async function lerRegistradoresBrutos(client) {
    const regStatus = await client.readHoldingRegisters(768, 1);
    const regMotor = await client.readHoldingRegisters(1024, 6);
    const regRede = await client.readHoldingRegisters(1061, 5);
    const regGerador = await client.readHoldingRegisters(1536, 12);
    const regStats = await client.readHoldingRegisters(1799, 11);
    return { regStatus, regMotor, regRede, regGerador, regStats };
}

async function lerGeradorCompleto(config, client = new ModbusRTU()) {
    try {
        client.setTimeout(3000);
        await client.connectTCP(config.ip, { port: config.porta });
        client.setID(config.slaveId);
        const blocos = await lerRegistradoresBrutos(client);
        return decodificarTelemetria(blocos);
    } finally {
        client.close();
    }
}

// substituir o module.exports existente por:
module.exports = { decodificarTelemetria, lerRegistradoresBrutos, lerGeradorCompleto };
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `cd gerador-monitor && node --test test/leitor.test.js`
Expected: PASS — 10 testes passando (7 da Task 1 + 3 novos)

- [ ] **Step 5: Commit**

```bash
git add gerador-monitor/src/leitor.js gerador-monitor/test/leitor.test.js
git commit -m "feat: leitura Modbus bruta e wrapper de conexão com o gateway DSE 890"
```

---

### Task 3: Módulo de banco de dados (`db.js`)

**Files:**
- Create: `gerador-monitor/src/db.js`
- Test: `gerador-monitor/test/db.test.js`

**Interfaces:**
- Consumes: objeto `telemetria` no formato retornado por `decodificarTelemetria` (Task 1) — chaves
  `time, modo_operacao, status_concessionaria, motor_status, rpm, temperatura_c, bateria_v,
  combustivel_pct, rede_freq_hz, rede_volts_l1/l2/l3, gerador_volts_l1/l2/l3,
  gerador_amps_l1/l2/l3, partidas, energia_kwh, energia_kvarh, energia_kvah`.
- Produces:
  - `criarPool()` — cria e retorna um `pg.Pool` configurado via env vars
    (`DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD`).
  - `insertLeitura(pool, telemetria)` — `INSERT` na tabela `leituras`.
  - `insertFalha(pool, mensagemErro, agora = new Date())` — `INSERT` na tabela `falhas_coleta`.
  - Ambos os inserts esperam um `pool` com método `.query(sql, params)` (interface do `pg.Pool`).

- [ ] **Step 1: Escrever os testes de `insertLeitura` e `insertFalha`**

```javascript
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
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `cd gerador-monitor && node --test test/db.test.js`
Expected: FAIL — `Cannot find module '../src/db'`

- [ ] **Step 3: Implementar `db.js`**

```javascript
// gerador-monitor/src/db.js
const { Pool } = require('pg');

function criarPool() {
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
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `cd gerador-monitor && node --test test/db.test.js`
Expected: PASS — 3 testes passando

- [ ] **Step 5: Commit**

```bash
git add gerador-monitor/src/db.js gerador-monitor/test/db.test.js
git commit -m "feat: módulo de persistência em TimescaleDB (leituras e falhas_coleta)"
```

---

### Task 4: Loop de coleta (`index.js`)

**Files:**
- Create: `gerador-monitor/src/index.js`
- Test: `gerador-monitor/test/index.test.js`

**Interfaces:**
- Consumes: `lerGeradorCompleto(config)` (Task 2), `insertLeitura(pool, telemetria)` e
  `insertFalha(pool, mensagemErro)` (Task 3), `criarPool()` (Task 3).
- Produces: `executarCiclo(deps)`, onde
  `deps = { pool, lerGeradorCompleto, insertLeitura, insertFalha }`. Um ciclo: chama
  `deps.lerGeradorCompleto(config)`; em sucesso, chama `deps.insertLeitura(deps.pool, telemetria)`;
  em erro, loga e chama `deps.insertFalha(deps.pool, erro.message)` — nunca deixa o erro subir
  (não derruba o processo).

- [ ] **Step 1: Escrever os testes de `executarCiclo`**

```javascript
// gerador-monitor/test/index.test.js
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
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `cd gerador-monitor && node --test test/index.test.js`
Expected: FAIL — `Cannot find module '../src/index'`

- [ ] **Step 3: Implementar `index.js`**

```javascript
// gerador-monitor/src/index.js
const { lerGeradorCompleto } = require('./leitor');
const { criarPool, insertLeitura, insertFalha } = require('./db');

const config = {
    ip: process.env.GATEWAY_IP,
    porta: Number(process.env.GATEWAY_PORTA || 502),
    slaveId: Number(process.env.GATEWAY_SLAVE_ID || 10)
};
const INTERVALO_MS = Number(process.env.INTERVALO_MS || 10000);

async function executarCiclo(deps) {
    try {
        const telemetria = await deps.lerGeradorCompleto(config);
        await deps.insertLeitura(deps.pool, telemetria);
    } catch (erro) {
        console.error(`[WORKER] Erro de coleta: ${erro.message}`);
        try {
            await deps.insertFalha(deps.pool, erro.message);
        } catch (erroInsert) {
            console.error(`[WORKER] Erro ao gravar falha no banco: ${erroInsert.message}`);
        }
    }
}

function agendarProximoCiclo(deps) {
    setTimeout(async () => {
        await executarCiclo(deps);
        agendarProximoCiclo(deps);
    }, INTERVALO_MS);
}

function main() {
    const pool = criarPool();
    const deps = { pool, lerGeradorCompleto, insertLeitura, insertFalha };
    console.log(`[WORKER] Iniciando coleta a cada ${INTERVALO_MS}ms (gateway ${config.ip}:${config.porta}, slave ${config.slaveId})`);
    agendarProximoCiclo(deps);
}

if (require.main === module) {
    main();
}

module.exports = { executarCiclo };
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `cd gerador-monitor && node --test test/index.test.js`
Expected: PASS — 3 testes passando

- [ ] **Step 5: Commit**

```bash
git add gerador-monitor/src/index.js gerador-monitor/test/index.test.js
git commit -m "feat: loop de coleta contínua a cada INTERVALO_MS com tratamento de falhas"
```

---

### Task 5: Schema SQL e atualização do `package.json`

**Files:**
- Create: `gerador-monitor/db/init.sql`
- Modify: `gerador-monitor/package.json`

**Interfaces:**
- Produces: schema `leituras` (hypertable) e `falhas_coleta` (hypertable), ambas com
  `add_retention_policy(..., INTERVAL '90 days')`, aplicado automaticamente na primeira subida do
  container TimescaleDB via `docker-entrypoint-initdb.d`.

- [ ] **Step 1: Criar o schema SQL**

```sql
-- gerador-monitor/db/init.sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS leituras (
    time                  TIMESTAMPTZ NOT NULL,
    modo_operacao         TEXT NOT NULL,
    status_concessionaria TEXT NOT NULL,
    motor_status          TEXT NOT NULL,
    rpm                   SMALLINT NOT NULL,
    temperatura_c         SMALLINT,
    bateria_v             NUMERIC(4,1) NOT NULL,
    combustivel_pct       SMALLINT NOT NULL,
    rede_freq_hz          NUMERIC(5,2) NOT NULL,
    rede_volts_l1         NUMERIC(5,1) NOT NULL,
    rede_volts_l2         NUMERIC(5,1) NOT NULL,
    rede_volts_l3         NUMERIC(5,1) NOT NULL,
    gerador_volts_l1      NUMERIC(6,1) NOT NULL,
    gerador_volts_l2      NUMERIC(6,1) NOT NULL,
    gerador_volts_l3      NUMERIC(6,1) NOT NULL,
    gerador_amps_l1       NUMERIC(6,1) NOT NULL,
    gerador_amps_l2       NUMERIC(6,1) NOT NULL,
    gerador_amps_l3       NUMERIC(6,1) NOT NULL,
    partidas              INTEGER NOT NULL,
    energia_kwh           NUMERIC(10,1) NOT NULL,
    energia_kvarh         NUMERIC(10,1) NOT NULL,
    energia_kvah          NUMERIC(10,1) NOT NULL
);

SELECT create_hypertable('leituras', 'time');
SELECT add_retention_policy('leituras', INTERVAL '90 days');

CREATE TABLE IF NOT EXISTS falhas_coleta (
    time TIMESTAMPTZ NOT NULL,
    erro TEXT NOT NULL
);

SELECT create_hypertable('falhas_coleta', 'time');
SELECT add_retention_policy('falhas_coleta', INTERVAL '90 days');
```

- [ ] **Step 2: Atualizar `package.json`**

```json
{
  "name": "gerador-monitor",
  "version": "1.0.0",
  "description": "Worker de coleta de telemetria do gerador Deep Sea 4520 MKII",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test test/"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "modbus-serial": "^8.0.25",
    "pg": "^8.13.1"
  }
}
```

- [ ] **Step 3: Instalar a dependência nova e rodar toda a suíte de testes**

Run: `cd gerador-monitor && npm install pg@^8.13.1`
Run: `node --test test/`
Expected: PASS — 16 testes passando (7 + 3 + 3 + 3 das tasks anteriores)

- [ ] **Step 4: Commit**

```bash
git add gerador-monitor/db/init.sql gerador-monitor/package.json gerador-monitor/package-lock.json
git commit -m "feat: schema TimescaleDB com retention de 90 dias e dependência pg"
```

---

### Task 6: Dockerfile, Docker Compose e configuração de ambiente

**Files:**
- Create: `gerador-monitor/Dockerfile`
- Create: `gerador-monitor/docker-compose.yml`
- Create: `gerador-monitor/.env.example`
- Modify: `gerador-monitor/.gitignore` (novo arquivo, se ainda não existir localmente — o `.gitignore`
  raiz do repo já ignora `.env`, então basta confirmar que ele cobre `gerador-monitor/.env`)

**Interfaces:**
- Produces: stack Docker Compose com dois serviços — `timescaledb` (porta 5432 exposta na rede da
  VM) e `worker` (build local, depende de `timescaledb`, `restart: unless-stopped`).

- [ ] **Step 1: Criar o Dockerfile**

```dockerfile
# gerador-monitor/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

CMD ["node", "src/index.js"]
```

- [ ] **Step 2: Criar o `docker-compose.yml`**

```yaml
# gerador-monitor/docker-compose.yml
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg16
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - timescaledb_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro

  worker:
    build: .
    restart: unless-stopped
    depends_on:
      - timescaledb
    environment:
      GATEWAY_IP: ${GATEWAY_IP}
      GATEWAY_PORTA: ${GATEWAY_PORTA}
      GATEWAY_SLAVE_ID: ${GATEWAY_SLAVE_ID}
      INTERVALO_MS: ${INTERVALO_MS}
      DB_HOST: timescaledb
      DB_PORT: 5432
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}

volumes:
  timescaledb_data:
```

- [ ] **Step 3: Criar o `.env.example`**

```
GATEWAY_IP=10.40.10.111
GATEWAY_PORTA=502
GATEWAY_SLAVE_ID=10
INTERVALO_MS=10000
DB_NAME=gerador
DB_USER=gerador
DB_PASSWORD=changeme
```

- [ ] **Step 4: Validar a configuração do Compose (sem hardware real)**

Run: `cd gerador-monitor && cp .env.example .env && docker compose config`
Expected: imprime o YAML final resolvido sem erros (confirma sintaxe e interpolação de variáveis
válidas). Não sobe os containers ainda.

Run: `docker compose build worker`
Expected: build da imagem do worker conclui com sucesso.

- [ ] **Step 5: Commit**

```bash
git add gerador-monitor/Dockerfile gerador-monitor/docker-compose.yml gerador-monitor/.env.example
git commit -m "feat: empacotamento Docker do worker e do TimescaleDB"
```

---

### Task 7: Remover o script antigo e validar contra o hardware real

**Files:**
- Delete: `gerador-monitor/index.js` (lógica migrada para `src/leitor.js`, `src/db.js`,
  `src/index.js` nas Tasks 1–4)

**Interfaces:** nenhuma nova — esta task só faz limpeza e validação manual de ponta a ponta.

- [ ] **Step 1: Remover o script antigo**

```bash
git rm gerador-monitor/index.js
```

- [ ] **Step 2: Rodar a suíte completa de testes uma última vez**

Run: `cd gerador-monitor && node --test test/`
Expected: PASS — todos os 16 testes passando, sem referências ao arquivo removido.

- [ ] **Step 3: Commit da remoção**

```bash
git commit -m "chore: remove script antigo de leitura pontual (substituído pelo worker em src/)"
```

- [ ] **Step 4: Validação manual contra o gateway real (na VM de produção)**

Esta etapa não é automatizável (depende do hardware físico). Rodar na VM, na rede que alcança o
gateway `10.40.10.111`:

```bash
cd gerador-monitor
cp .env.example .env
# editar .env com a senha real do banco
docker compose up -d
docker compose logs -f worker
```

Checklist de validação (conforme a spec):
1. `docker compose logs -f worker` mostra leituras a cada ~10s sem erros de conexão.
2. `docker compose exec timescaledb psql -U gerador -d gerador -c "SELECT * FROM leituras ORDER BY time DESC LIMIT 5;"`
   retorna linhas com valores plausíveis (comparar com o painel físico do DSE).
3. Desconectar a rede até o gateway propositalmente por ~1 minuto e confirmar via
   `docker compose exec timescaledb psql -U gerador -d gerador -c "SELECT * FROM falhas_coleta ORDER BY time DESC LIMIT 5;"`
   que os erros foram registrados e o container `worker` continua rodando
   (`docker compose ps` mostra status `Up`, não reiniciando em loop).
4. Configurar um datasource Postgres no Grafana apontando para `<ip-da-vm>:5432`, banco `gerador`,
   e montar um painel simples (ex. série temporal de `rpm` a partir de `leituras`) para validar o
   fluxo ponta a ponta.

- [ ] **Step 5: Registrar o resultado da validação**

Sem commit de código nesta etapa — se a validação manual encontrar divergências (ex. escala errada
em algum registrador), abrir uma task de correção pontual no módulo `leitor.js` (Task 1/2) com
teste cobrindo o caso encontrado.
