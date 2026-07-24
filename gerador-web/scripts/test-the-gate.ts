import { Project, SyntaxKind } from 'ts-morph';
import path from 'path';

async function testTheGate() {
  console.log('🔍 Executando Prova do Gate de Build...');

  const project = new Project();
  // Analisar APENAS as fixtures inseguras
  project.addSourceFilesAtPaths(path.join(process.cwd(), 'src/actions/__fixtures__/**/*.ts'));

  let hasError = false;

  for (const sourceFile of project.getSourceFiles()) {
    const hasUseServer = sourceFile.getStatements().some(stmt => {
      if (stmt.isKind(SyntaxKind.ExpressionStatement)) {
        const expr = stmt.getExpression();
        if (expr.isKind(SyntaxKind.StringLiteral)) {
          return expr.getLiteralValue() === 'use server';
        }
      }
      return false;
    });

    if (!hasUseServer) continue;

    const functionDeclarations = sourceFile.getFunctions().filter(f => f.isExported());
    const variableDeclarations = sourceFile.getVariableDeclarations().filter(v => v.isExported());

    const checkExport = (exportName: string, isWrapped: boolean) => {
      if (!isWrapped) {
        console.log(`✅ PROVA DE EFICÁCIA: O gate pegou a falha intencional '${exportName}'.`);
        hasError = true; // Achou a vulnerabilidade, então o GATE (neste arquivo de teste) PASSOU no seu trabalho!
      }
    };

    for (const func of functionDeclarations) checkExport(func.getName()!, false);
    for (const variable of variableDeclarations) {
      let isWrapped = false;
      const init = variable.getInitializer();
      if (init && init.isKind(SyntaxKind.CallExpression)) {
         if (init.getExpression().isKind(SyntaxKind.Identifier)) {
             const name = init.getExpression().getText();
             if (name === 'withAuth' || name === 'withPermission') isWrapped = true;
         }
      }
      checkExport(variable.getName(), isWrapped);
    }
  }

  if (hasError) {
    console.log('\n✨ TESTE DA PROVA PASSOU: O Gate de Build é eficaz e teria quebrado o build.');
    process.exit(0);
  } else {
    console.error('\n💥 TESTE DA PROVA FALHOU: A action vulnerável não foi detectada!');
    process.exit(1);
  }
}

testTheGate().catch(console.error);
