# AuthForge: Architecture & Design Patterns

Este documento descreve a arquitetura de alto nível do AuthForge, as decisões técnicas e os padrões de projeto adotados.

---

## 1. Padrões de Arquitetura

### 1.1 Server Actions como Camada de Mutação
Ao invés de rotas de API em `/api/*`, o AuthForge utiliza **React Server Actions** para todas as mutações no banco (ex: `updateUser`, `loginAction`, `revokeSession`).
- **Padrão**: Command Pattern + Wrappers. **Toda** Server Action é envolvida pelos wrappers `withAuth` e `withPermission`, que garantem sessão e RBAC centralizados.
- **Gate de Build**: Um script no `npm run build` enumera `src/actions/**` e reprova a compilação se alguma action escapar dos wrappers, impedindo falhas de omissão.
- **Exceção**: Rotas de API são usadas para fluxos que precisam setar cookies (OAuth callbacks, Magic Link verify).

### 1.2 Sessões Opacas Stateful (ADR-001)
Não utilizamos JWT sem estado no lado do cliente.
- **Como Funciona**: O usuário recebe um cookie `session_token` (Token Opaco). Cada requisição valida esse ID contra a tabela `Session` no banco de dados.
- **Vantagem**: Revogação instantânea (Kill Switch), listagem de dispositivos conectados em tempo real.

### 1.3 Injeção de Tema por CSS Variables
A configuração de cores (`ThemeConfig`) fica no banco e é injetada via CSS Variables (`--primary`, `--surface`, etc.) no Root Layout.
- O modo `dark/light` é gerenciado injetando a classe `.dark` na tag `<html>` pelo servidor.
- Cores, logos e favicon são configuráveis pelo painel White-Label.

### 1.4 Componentes Híbridos (Server/Client)
- **Server Components (Page)**: Fetch inicial de dados via Prisma.
- **Client Components**: Recebem dados via `props` e gerenciam estado, modais e transições.
- **Padrão de nomeação**: `[rota]-client.tsx` (ex: `users-client.tsx`).

---

## 2. Autenticação Multi-Método

### 2.1 E-mail e Senha
- Hash com bcrypt (via `verifyPassword`)
- Rate limiting por IP (20 req/min) e por e-mail (5 req/15min)
- Suporte a 2FA (TOTP) com Google Authenticator
- Fluxo: `loginAction → verifyPassword → [2FA check] → createSession`

### 2.2 Magic Link
- Token de 32 bytes via `crypto.randomBytes`
- Validade: 15 minutos, uso único (marcado com `usedAt`)
- Fluxo: `requestMagicLink → sendEmail → /auth/verify?token=xxx (Route Handler) → createSession → redirect /dashboard`
- Tokens anteriores são deletados ao solicitar novo

### 2.3 OAuth (Google, GitHub, Microsoft)
- **Authorization Code Flow** padrão com **PKCE** implementado.
- Proteção CSRF via `state` token em cookie.
- Tenant explícito exigido para Azure AD (bloqueio de tenant common para segurança).
- Credenciais lidas do DB (`AuthConfig`), encriptadas em repouso.
- Fluxo: `/api/auth/[provider] → redirect ao provedor → /api/auth/callback/[provider] → find/create user → createSession`
- **Resolução inteligente de usuário**:
  1. Existe `OAuthAccount`? → usa o user vinculado
  2. Existe `User` por email? → auto-link bloqueado, exige login local prévio para vincular
  3. Nenhum? → auto-provisiona com role padrão

### 2.4 LDAP / Active Directory
- Bind com conta de serviço + busca do usuário
- TLS estrito com CA corporativa configurável. Escape de filtro RFC 4515 e rejeição de bind vazio.
- Formatos aceitos: UPN (`user@domain.local`), DN completo, IP direto
- Senha local do AD encriptada com AES-256-GCM no banco (fallback)
- Auto-provisão no primeiro login, atualização de dados nos subsequentes

### 2.5 2FA (TOTP)
- TOTP compatível com Google Authenticator, limitando tentativa via Rate limit alimentando lockout.
- Contador TOTP monotônico com update atômico (anti-replay).
- 10 códigos de backup gerados automaticamente (80 bits) persistidos com Argon2id + prefixo.
- Segredos encriptados em repouso com AES-256-GCM.

---

## 3. Controle de Acesso (RBAC)

O sistema é baseado em **Roles** e **Permissions** com granularidade `recurso:ação`.

- **Exemplo**: `users:create`, `roles:manage`, `*:manage` (SuperAdmin)
- **Guard Code**: `src/lib/permissions.ts` → função **`checkPermission()`** (Motor unificado). Todas as ações executam essa checagem através do wrapper `withPermission`.
- **Owner**: Permissão total implícita, não pode ser desativado.

---

## 4. Segurança Global

Parâmetros dinâmicos configuráveis pelo painel:
1. **Política de Senhas**: Tamanho, maiúsculas, números, símbolos, expiração (Argon2id para senhas e tokens).
2. **Força Bruta**: Tentativas máximas + tempo de bloqueio (por IP e conta) com Rate limit em PostgreSQL (upsert atômico).
3. **Sessões**: Duração máxima configurável, cookie HttpOnly.
4. **Segredos Cifrados em Repouso**: Todos os tokens, SMTP, LDAP e credenciais sensíveis atrás de um módulo único de cifra (AES-256-GCM).
5. **Audit Log**: Event Sourcing simplificado com `logAudit()` assíncrono para trilha rigorosa.

---

## 5. E-mail

Gateway unificado suportando:
- **SMTP** (Gmail, Outlook, SMTP corporativo)
- **Resend** (API)

Configuração armazenada no banco (`EmailConfig`), cifrada em repouso e gerenciável pelo painel admin.

---

## 6. Middleware & Proxy

O `proxy.ts` atua como **optimistic check de UX**:
- Aplica Security Headers (HSTS, CSP com `nonce` validada, XSS).
- Protege a UI redirecionando para `/login` se o cookie `session_token` não existir.
- Redireciona para Setup Wizard se sistema não instalado.
- **Atenção**: Ele NÃO é a camada real de autorização. A segurança verdadeira opera exclusivamente nas Server Actions via wrappers (`withAuth`/`withPermission`).

---

## 7. Deploy

- **Docker (gerador-web)**: multi-stage Dockerfile com `node_modules` completo copiado entre
  estágios (não usa `output: 'standalone'`) — mais simples de manter, evita as particularidades
  de rastreamento de arquivos do modo standalone. O `docker-entrypoint.sh` roda
  `prisma migrate deploy` antes de iniciar o servidor Next.js a cada subida do container.
- **Vercel**: Deploy direto com env vars no painel
- **Banco**: PostgreSQL (recomendado) ou MySQL/MariaDB via Prisma

---

## 8. Integração com a Telemetria do Gerador (gerador-web)

- Banco de telemetria (`leituras`, `falhas_coleta`) é populado pelo worker `gerador-monitor`,
  externo a este app — este app nunca escreve nele.
- Leitura via `src/lib/gerador-db.ts`: `pg.Pool` dedicado, configurado por
  `GERADOR_DB_HOST/PORT/NAME/USER/PASSWORD`, completamente separado do `db.ts` (Prisma) usado
  para os dados próprios deste app.
- Verificação manual de conectividade: `npx tsx scripts/check-gerador-db.ts`.
