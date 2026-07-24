import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

/**
 * Esse script inicia a aplicação temporariamente em modo dev (se não estiver rodando na porta 3000),
 * lê todas as pastas dentro de src/app/auth/ e faz uma requisição HTTP para cada rota (sem cookies)
 * garantindo que elas não retornem 307 pelo proxy.
 */

const AUTH_DIR = path.join(__dirname, '../src/app/auth');
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function getAuthRoutes(): string[] {
  const routes: string[] = [];
  const items = fs.readdirSync(AUTH_DIR, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory() && !item.name.startsWith('[')) {
      routes.push(`/auth/${item.name}`);
    }
  }
  return routes;
}

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL);
    return true; // Se respondeu, está rodando
  } catch {
    return false;
  }
}

async function startDevServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    console.log('🚀 Servidor não está rodando. Iniciando next dev...');
    const server = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
    });

    server.stdout?.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Ready in') || msg.includes('started server on') || msg.includes('Ready on')) {
        console.log('✅ Servidor iniciado!');
        resolve(server);
      }
    });

    server.stderr?.on('data', (data) => {
      // Ignora avisos normais do dev
    });

    server.on('error', (err) => {
      console.error('❌ Erro ao iniciar servidor:', err);
      reject(err);
    });

    // Timeout de 30 segundos
    setTimeout(() => {
      reject(new Error('Timeout aguardando inicialização do servidor.'));
      server.kill();
    }, 30000);
  });
}

async function checkRoute(route: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' });
    // Se retornar 307 com redirect para /login E com callbackUrl, o proxy barrou.
    const loc = res.headers.get('location');
    if (res.status === 307 && loc && loc.includes('/login') && loc.includes('callbackUrl=')) {
      console.error(`❌ [FALHA] Rota ${route} retornou 307 para o login pelo proxy. Ela não está listada no proxy.ts!`);
      return false;
    } else {
      console.log(`✅ [OK] Rota ${route} retornou ${res.status}.`);
      return true;
    }
  } catch (err: any) {
    console.error(`Erro ao acessar ${route}: ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log('Iniciando verificação de rotas públicas em /auth/...');
  const routes = getAuthRoutes();
  console.log(`Rotas encontradas: ${routes.join(', ')}`);

  let serverProcess: ChildProcess | null = null;
  const running = await isServerRunning();
  
  if (!running) {
    try {
      serverProcess = await startDevServer();
      // Dá mais 2 segundinhos para o app inicializar completamente a primeira rota
      await new Promise(r => setTimeout(r, 2000)); 
    } catch (err: any) {
      console.error('Falha fatal ao preparar o servidor:', err.message);
      process.exit(1);
    }
  }

  let allPassed = true;
  for (const route of routes) {
    const passed = await checkRoute(route);
    if (!passed) allPassed = false;
  }

  if (serverProcess) {
    console.log('🛑 Encerrando servidor de testes...');
    serverProcess.kill();
  }

  if (!allPassed) {
    console.error('\n🚨 TESTES FALHARAM! Pelo menos uma rota em /auth/ não está pública no proxy.ts.');
    process.exit(1);
  } else {
    console.log('\n✨ Todos os testes passaram! Rotas em /auth/ estão acessíveis.');
    process.exit(0);
  }
}

runTests();
