const ModbusRTU = require("modbus-serial");

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

module.exports = { decodificarTelemetria, lerRegistradoresBrutos, lerGeradorCompleto };
