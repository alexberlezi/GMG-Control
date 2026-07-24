import { Project, SyntaxKind } from 'ts-morph';
import path from 'path';

// Allowlist com chaveamento exato por "caminho_relativo::nome_funcao"
// Se a entrada não for encontrada no código real, o teste falhará para evitar entradas fantasmas.
const ALLOWLIST = new Set([
  'src/actions/auth.ts::loginAction',
  'src/actions/auth.ts::verify2FALogin',
  'src/actions/auth.ts::resetPasswordWithToken',
  'src/actions/magic-link.ts::requestMagicLink',
  'src/actions/setup.ts::executeSetup',
  'src/actions/theme-config.ts::getThemeConfig',
  'src/app/invite/[token]/actions.ts::acceptInvite',
]);

// Ignorar as fixtures intencionalmente inseguras que provam que o gate funciona
const IGNORE_PATHS = ['src/actions/__fixtures__/'];

async function runStaticAnalysis() {
  console.log('🔍 Executando Teste Automatizado de Análise Estática (AST) de Server Actions...');

  const project = new Project();
  // Varrer todos os arquivos .ts do diretório src
  project.addSourceFilesAtPaths(path.join(process.cwd(), 'src/**/*.ts'));

  let hasError = false;
  const allowlistFound = new Set<string>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

    // Pular diretórios ignorados
    if (IGNORE_PATHS.some(p => relativePath.startsWith(p))) {
      continue;
    }

    // Server Actions só existem em arquivos marcados com 'use server'
    const hasUseServer = sourceFile.getStatements().some(stmt => {
      if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
        const expr = stmt.getExpression();
        if (expr.isKind(SyntaxKind.StringLiteral)) {
          return expr.getLiteralValue() === 'use server';
        }
      }
      return false;
    });

    if (!hasUseServer) {
      continue; // Não expõe server actions
    }

    console.log(`[AST] Analisando Server Action: ${relativePath}`);

    // Buscar exports de funções (export function, export async function)
    const functionDeclarations = sourceFile.getFunctions().filter(f => f.isExported());
    
    // Buscar exports de variáveis (export const x = ...)
    const variableDeclarations = sourceFile.getVariableDeclarations().filter(v => v.isExported());

    const checkExport = (exportName: string, isWrapped: boolean) => {
      const allowlistKey = `${relativePath}::${exportName}`;

      if (ALLOWLIST.has(allowlistKey)) {
        allowlistFound.add(allowlistKey);
        console.log(`  ✅ [PUBLIC] ${exportName} (Autorizado pela Allowlist)`);
      } else if (isWrapped) {
        console.log(`  🔒 [SECURE] ${exportName} (Protegido por wrapper)`);
      } else {
        console.error(`  🚨 VULNERABILIDADE DETECTADA: O export '${exportName}' em '${relativePath}' está exposto (use server) e NÃO utiliza wrapper de segurança (withAuth/withPermission).`);
        hasError = true;
      }
    };

    // Analisando export function
    for (const func of functionDeclarations) {
      const name = func.getName();
      if (!name) continue;
      // Funções regulares (export function x() {}) não estão encapsuladas
      checkExport(name, false);
    }

    // Analisando export const
    for (const variable of variableDeclarations) {
      const name = variable.getName();
      const initializer = variable.getInitializer();

      let isWrapped = false;

      // Verificar se o inicializador é uma chamada de withAuth ou withPermission
      if (initializer && initializer.isKind(SyntaxKind.CallExpression)) {
        const expression = initializer.getExpression();
        if (expression.isKind(SyntaxKind.Identifier)) {
          const funcName = expression.getText();
          if (funcName === 'withAuth' || funcName === 'withPermission') {
            isWrapped = true;
          }
        }
      }

      checkExport(name, isWrapped);
    }
  }

  // Validar allowlist fantasma
  for (const expected of ALLOWLIST) {
    if (!allowlistFound.has(expected)) {
      console.error(`🚨 ALERTA ALLOWLIST FANTASMA: A entrada '${expected}' está na allowlist mas não foi encontrada no código real.`);
      hasError = true;
    }
  }

  if (hasError) {
    console.error('\n💥 TESTE FALHOU: A análise estática encontrou violações de contenção. O build foi bloqueado.');
    process.exit(1);
  } else {
    console.log('\n✨ TESTE PASSOU: Todas as Server Actions (use server) estão encapsuladas.');
    process.exit(0);
  }
}

runStaticAnalysis().catch(err => {
  console.error('Erro fatal no teste:', err);
  process.exit(1);
});
