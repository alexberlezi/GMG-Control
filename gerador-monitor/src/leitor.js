const ModbusRTU = require("modbus-serial");

function decodificarTelemetria({ regStatus, regMotor, regRede, regGerador, regStats, regFrequencia }, agora = new Date()) {
    const codModo = regStatus.data[0];
    let modoOperacao = "Desconhecido";
    if (codModo === 0) modoOperacao = "Parado (Stop)";
    if (codModo === 1) modoOperacao = "Automático";
    if (codModo === 2) modoOperacao = "Manual";
    if (codModo === 3) modoOperacao = "Teste";

    // regMotor.data[6] (endereço 1030), não data[0] (1024): validado com o motor rodando de
    // verdade — 1024 sempre retorna 65535 (sem captador de RPM instalado), 1030 acompanhou o
    // painel físico (1800 RPM). O endereço do documento de integração está errado para este DSE.
    let rpmMotor = regMotor.data[6];
    if (rpmMotor === 65535) rpmMotor = 0;

    // regMotor.data[1] (endereço 1025), não data[2] (1026): validado contra o valor real
    // (56°C) mostrado no sistema de operação remota do gerador — 1026 sempre retorna 32767
    // (esse sim é um sensor realmente ausente, provavelmente pressão de óleo).
    const temperatura = regMotor.data[1];
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

    // regFrequencia (endereço 1059, /10), não regStats.data[0] (1799, /100): validado contra
    // o valor real (60,00 Hz fixo) mostrado no sistema de operação remota do gerador — 1799
    // subia continuamente e depois travava (comportamento de contador, não de frequência).
    const freqRede = regFrequencia.data[0] / 10;
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
    // Endereço 772, não 768: validado trocando a chave física para Manual e conferindo o
    // valor retornado (2 = Manual) contra o painel — 768 ficava travado em 1 independente
    // da posição real da chave. Também documento errado para este DSE.
    const regStatus = await client.readHoldingRegisters(772, 1);
    const regMotor = await client.readHoldingRegisters(1024, 7);
    // Endereço 1059: frequência real da rede — descoberto por varredura, fora do bloco
    // de estatísticas (1799) que o documento original indicava.
    const regFrequencia = await client.readHoldingRegisters(1059, 1);
    const regRede = await client.readHoldingRegisters(1061, 5);
    const regGerador = await client.readHoldingRegisters(1536, 12);
    const regStats = await client.readHoldingRegisters(1799, 11);
    return { regStatus, regMotor, regFrequencia, regRede, regGerador, regStats };
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
