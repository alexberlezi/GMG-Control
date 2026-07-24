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
