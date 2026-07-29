# Task 9 — Correção de achados de revisão: `src/app/dashboard/page.tsx`

## Commit
`70b52b4956d4fffc5a0c894b096e4e76582854e3` — fix(gerador-web): trata erro de telemetria e limpa imports não usados na dashboard principal

## Resumo das mudanças

### Important
- Adicionada variável `geradorError` que é setada `true` no `catch` da busca de dados do gerador
  (`getUltimaLeitura()` + `db.registroManutencao.findMany`). Quando `hasGeneratorAccess &&
  geradorError`, a seção do gerador agora renderiza um `.alert.alert-error` com o ícone
  `ServerCrash` (mesmo padrão de `src/app/dashboard/gerador/page.tsx`), avisando "Não foi possível
  conectar ao banco de telemetria." O restante do dashboard (usuários/sessões/auditoria) continua
  renderizando normalmente.

### Minor
1. Removidos os imports não usados: `getHistoricoGerador` (de `@/lib/gerador-db`), e os ícones
   `AlertTriangle` e `CheckCircle` (de `lucide-react`). Adicionado `ServerCrash` (usado na correção
   do achado Important).
2. Trocado o emoji `🔧` antes do tipo de manutenção pelo ícone `Wrench` (`lucide-react`, size 14,
   `text-primary`), reaproveitando o import já existente (usado também no cabeçalho "Manutenções
   Recentes").

## Diff aplicado

```diff
diff --git a/gerador-web/src/app/dashboard/page.tsx b/gerador-web/src/app/dashboard/page.tsx
index 44b62c6..acdf4b8 100644
--- a/gerador-web/src/app/dashboard/page.tsx
+++ b/gerador-web/src/app/dashboard/page.tsx
@@ -1,8 +1,8 @@
 import { db } from '@/lib/db';
 import { validateSession } from '@/lib/auth/session';
 import { can } from '@/lib/permissions';
-import { getUltimaLeitura, getHistoricoGerador } from '@/lib/gerador-db';
-import { Users, ShieldCheck, Activity, Globe, Zap, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
+import { getUltimaLeitura } from '@/lib/gerador-db';
+import { Users, ShieldCheck, Activity, Globe, Zap, Wrench, ServerCrash } from 'lucide-react';
 import { GeradorStatusCards } from '@/components/dashboard/gerador/gerador-status-cards';
 
 export default async function DashboardPage() {
@@ -26,6 +26,7 @@ export default async function DashboardPage() {
   // Fetch generator and maintenance data if user has permission
   let geradorData = null;
   let manutencaoData = null;
+  let geradorError = false;
   const hasGeneratorAccess = await can(session.user.id, 'generator', 'read');
 
   if (hasGeneratorAccess) {
@@ -43,6 +44,7 @@ export default async function DashboardPage() {
       manutencaoData = ultimasManutencoes;
     } catch (error) {
       console.error('Erro ao buscar dados do gerador:', error);
+      geradorError = true;
     }
   }
 
@@ -80,6 +82,18 @@ export default async function DashboardPage() {
       </div>
 
       {/* Generator Section */}
+      {hasGeneratorAccess && geradorError && (
+        <div className="alert alert-error">
+          <ServerCrash size={20} className="shrink-0" />
+          <div>
+            <p className="font-medium">Não foi possível conectar ao banco de telemetria.</p>
+            <p className="text-sm opacity-80 mt-1">
+              Verifique se o serviço de coleta e o banco de dados do gerador estão acessíveis.
+            </p>
+          </div>
+        </div>
+      )}
+
       {hasGeneratorAccess && geradorData && (
         <div>
           <div className="mb-4">
@@ -106,8 +120,9 @@ export default async function DashboardPage() {
               <div key={manutencao.id} className="px-5 py-4 hover:bg-surface-container-low/50 transition-colors">
                 <div className="flex items-start justify-between gap-4">
                   <div className="flex-1 min-w-0">
-                    <p className="text-sm font-medium text-on-surface">
-                      🔧 {manutencao.tipo.replace(/_/g, ' ')}
+                    <p className="text-sm font-medium text-on-surface flex items-center gap-1.5">
+                      <Wrench size={14} className="text-primary shrink-0" />
+                      {manutencao.tipo.replace(/_/g, ' ')}
                     </p>
                     {manutencao.observacoes && (
                       <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{manutencao.observacoes}</p>
```

## Verificação

### `npx tsc --noEmit`
Sem saída — passou sem erros.

### `npx eslint src/app/dashboard/page.tsx`
```
C:\Users\alexb\OneDrive\Projetos\Gerador\.claude\worktrees\gerador-web-plano-c-dashboard\gerador-web\src\app\dashboard\page.tsx
  17:57  error  Error: Cannot call impure function during render

`Date.now` is an impure function. ...
  15 |     db.session.count({ where: { expiresAt: { gt: new Date() } } }),
  16 |     db.loginAttempt.count({
> 17 |       where: { success: true, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
     |                                                         ^^^^^^^^^^ Cannot call impure function
  18 |     }),
  19 |     db.auditLog.findMany({
  20 |       take: 10,  react-hooks/purity

✖ 1 problem (1 error, 0 warnings)
```
Esse erro é o problema pré-existente `Date.now()` em `db.loginAttempt.count`, explicitamente fora
do escopo desta correção. Nenhum erro de "unused vars" (`getHistoricoGerador`, `AlertTriangle`,
`CheckCircle`) aparece mais — confirma que os 3 imports não usados foram removidos com sucesso.

### `npx next build`
Build concluído com sucesso (Next.js 16.2.10, Turbopack). Rota `/dashboard` listada como `ƒ`
(dynamic, server-rendered on demand), confirmando que a página segue como rota dinâmica.

```
Route (app)
┌ ƒ /
├ ƒ /_not-found
...
├ ƒ /dashboard
├ ƒ /dashboard/audit
├ ƒ /dashboard/gerador
...
ƒ  (Dynamic)  server-rendered on demand
```

## Escopo
Apenas `src/app/dashboard/page.tsx` foi alterado e commitado (`git add` nomeando o arquivo
explicitamente). Nenhum outro arquivo foi tocado; o problema pré-existente de `Date.now()` em
`db.loginAttempt.count` foi deixado intacto, conforme instruído.
