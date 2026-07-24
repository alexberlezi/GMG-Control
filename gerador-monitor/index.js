const ModbusRTU = require("modbus-serial");
const client = new ModbusRTU();

const IP_GERADOR = "10.40.10.111";
const PORTA = 502;
const SLAVE_ID = 10; 

async function lerGeradorCompleto() {
    try {
        client.setTimeout(3000);
        await client.connectTCP(IP_GERADOR, { port: PORTA });
        client.setID(SLAVE_ID);
        
        // 1. Bloco de Status (768)
        const regStatus = await client.readHoldingRegisters(768, 1);
        const codModo = regStatus.data[0];
        let modoOperacao = "Desconhecido";
        if (codModo === 0) modoOperacao = "Parado (Stop)";
        if (codModo === 1) modoOperacao = "Automático";
        if (codModo === 2) modoOperacao = "Manual";
        if (codModo === 3) modoOperacao = "Teste";

        // 2. Motor (1024)
        const regMotor = await client.readHoldingRegisters(1024, 6);
        let rpmMotor = regMotor.data[0]; 
        if (rpmMotor === 65535) rpmMotor = 0; 
        
        let temperatura = regMotor.data[2];
        let tempString = (temperatura === 32767 || temperatura === 65535) ? "Sem Sensor Analógico" : `${temperatura} °C`;
        
        let combustivel = regMotor.data[3]; 
        if (combustivel === 65535) combustivel = 0;

        const tensaoBateria = regMotor.data[5] / 10; 

        // 3. Rede (1061)
        const regRede = await client.readHoldingRegisters(1061, 5);
        const redeL1 = regRede.data[0] / 10;
        const redeL2 = regRede.data[2] / 10;
        const redeL3 = regRede.data[4] / 10;
        const statusRede = (redeL1 > 100 && redeL2 > 100) ? "Rede OK (Energia Presente)" : "FALHA NA REDE (Sem Energia)";

        // 4. Alternador (1536)
        const regGerador = await client.readHoldingRegisters(1536, 12);
        const genVoltsL1 = regGerador.buffer.readUInt32BE(0) / 10;
        const genVoltsL2 = regGerador.buffer.readUInt32BE(4) / 10;
        const genVoltsL3 = regGerador.buffer.readUInt32BE(8) / 10;
        const genAmpL1 = regGerador.buffer.readUInt32BE(12) / 10;
        const genAmpL2 = regGerador.buffer.readUInt32BE(16) / 10;
        const genAmpL3 = regGerador.buffer.readUInt32BE(20) / 10;

        // 5. Estatísticas de Energia (Lendo 11 registradores a partir de 1799)
        const regStats = await client.readHoldingRegisters(1799, 11);
        const freqRede = regStats.data[0] / 100;
        
        // Retornando para leitura 16-bits (conforme provado pelo scanner)
        const energiaKwh = regStats.data[2] / 10;   // 1801
        const energiaKvah = regStats.data[6] / 10;  // 1805
        const energiaKvarh = regStats.data[8] / 10; // 1807
        const numPartidas = regStats.data[10];      // 1809

        const dados = {
            timestamp: new Date().toISOString(),
            geral: {
                modo_operacao: modoOperacao,
                status_concessionaria: statusRede
            },
            motor: {
                status: rpmMotor > 0 ? "Rodando" : "Parado",
                rpm: rpmMotor,
                temperatura_c: temperatura === 32767 ? null : temperatura,
                bateria_v: tensaoBateria,
                combustivel_pct: combustivel
            },
            rede: {
                freq_hz: freqRede,
                volts_l1: redeL1,
                volts_l2: redeL2,
                volts_l3: redeL3
            },
            gerador: {
                volts_l1: genVoltsL1,
                volts_l2: genVoltsL2,
                volts_l3: genVoltsL3,
                amps_l1: genAmpL1,
                amps_l2: genAmpL2,
                amps_l3: genAmpL3,
                partidas: numPartidas,
                energia_kwh: energiaKwh,
                energia_kvarh: energiaKvarh,
                energia_kvah: energiaKvah
            }
        };

        console.log(`\n================== PAINEL DO GERADOR ==================`);
        console.log(`Data/Hora Leitura: ${dados.timestamp}`);
        console.log(`Modo da Chave:     ${dados.geral.modo_operacao.toUpperCase()}`);
        console.log(`Status da Rede:    ${dados.geral.status_concessionaria}`);
        
        console.log(`\n--- MOTOR ---------------------------------------------`);
        console.log(`Estado:            ${dados.motor.status.toUpperCase()} (${dados.motor.rpm} RPM)`);
        console.log(`Temperatura:       ${tempString}`);
        console.log(`Nível Combustível: ${dados.motor.combustivel_pct} %`);
        console.log(`Tensão da Bateria: ${dados.motor.bateria_v.toFixed(1)} V`);
        
        console.log(`\n--- REDE (Distribuidora) ------------------------------`);
        console.log(`Frequência:        ${dados.rede.freq_hz.toFixed(2)} Hz`);
        console.log(`Tensão (F-N):      L1: ${dados.rede.volts_l1.toFixed(1)} V  |  L2: ${dados.rede.volts_l2.toFixed(1)} V  |  L3: ${dados.rede.volts_l3.toFixed(1)} V`);
        
        console.log(`\n--- GERADOR (Alternador) ------------------------------`);
        console.log(`Tensão (F-N):      L1: ${dados.gerador.volts_l1.toFixed(1)} V  |  L2: ${dados.gerador.volts_l2.toFixed(1)} V  |  L3: ${dados.gerador.volts_l3.toFixed(1)} V`);
        console.log(`Corrente (Carga):  L1: ${dados.gerador.amps_l1.toFixed(1)} A  |  L2: ${dados.gerador.amps_l2.toFixed(1)} A  |  L3: ${dados.gerador.amps_l3.toFixed(1)} A`);
        
        console.log(`\n--- DADOS ACUMULADOS (ENERGIA) ------------------------`);
        console.log(`Total de Partidas: ${dados.gerador.partidas}`);
        console.log(`Potência Ativa:    ${dados.gerador.energia_kwh.toFixed(1)} kWh`);
        console.log(`Potência Reativa:  ${dados.gerador.energia_kvarh.toFixed(1)} kvarh`);
        console.log(`Potência Aparente: ${dados.gerador.energia_kvah.toFixed(1)} kVAh`);
        console.log(`=======================================================\n`);

    } catch (erro) {
        console.error("\n[ERRO NA COMUNICAÇÃO MODBUS]:", erro.message);
    } finally {
        client.close();
    }
}

lerGeradorCompleto();