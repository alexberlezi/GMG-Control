import 'dotenv/config';
import { getUltimaLeitura, geradorDb } from '../src/lib/gerador-db';

async function main() {
  const leitura = await getUltimaLeitura();
  console.log('Última leitura da telemetria:', leitura);
  await geradorDb.end();
}

main().catch((erro) => {
  console.error('Falha ao conectar no banco de telemetria:', erro.message);
  process.exit(1);
});
