# AuthForge: Codebase Map

Mapeamento completo da estrutura de código e dependências do AuthForge.

---

## Estrutura de Diretórios (`src/`)

### `app/dashboard/` — Rotas Protegidas
Todas dependem de sessão ativa (verificada pelo `proxy.ts`).

| Rota | Descrição |
|------|-----------|
| `layout.tsx` | Container global com Sidebar |
| `page.tsx` | Dashboard Overview |
| `users/` | Gestão de usuários (tabela, cards, CRUD) |
| `roles/` | Gerenciamento de Grupos e Permissões (RBAC) |
| `invites/` | Convites por e-mail |
| `sessions/` | Sessões ativas e dispositivos conectados |
| `audit/` | Log de auditoria (Event Sourcing) |
| `profile/` | Configurações da conta do usuário logado |
| `settings/appearance/` | White-Label: cores, logos, favicon, layout de login |
| `settings/auth/` | Métodos de autenticação (E-mail, Magic Link, OAuth, LDAP, 2FA) |
| `settings/email/` | Configuração de SMTP/Resend |
| `settings/security/` | Políticas de senha, bloqueio, sessão, Turnstile |

### `app/(auth)/` — Rotas Públicas
| Rota | Descrição |
|------|-----------|
| `login/` | Tela de login (split-screen) |
| `register/` | Registro de novos usuários |
| `setup/` | Setup Wizard (primeira execução) |
| `forgot-password/` | Recuperação de senha |
| `reset-password/` | Redefinição de senha via token |
| `invite/[token]/` | Aceite de convite |

### `app/api/auth/` — Route Handlers (OAuth & Magic Link)
| Rota | Descrição |
|------|-----------|
| `[provider]/route.ts` | Inicia fluxo OAuth (gera state, redireciona) |
| `callback/[provider]/route.ts` | Callback OAuth (troca code, cria sessão) |

### `app/auth/` — Route Handler (Magic Link)
| Rota | Descrição |
|------|-----------|
| `verify/route.ts` | Valida token do Magic Link e cria sessão |

---

### `actions/` — Server Actions (Mutations)
| Arquivo | Responsabilidade |
|---------|-----------------|
| `auth.ts` | Login (local + LDAP), 2FA, logout |
| `2fa.ts` | Setup/Disable TOTP, gerar backup codes |
| `magic-link.ts` | Gerar e enviar Magic Link |
| `users.ts` | CRUD de usuários |
| `roles.ts` | CRUD de grupos e permissões |
| `sessions.ts` | Listar/revogar sessões |
| `invites.ts` | CRUD de convites |
| `profile.ts` | Atualização de perfil do usuário logado |
| `auth-config.ts` | Salvar configurações de autenticação |
| `ldap-config.ts` | Salvar/testar configuração LDAP |
| `email-config.ts` | Salvar configuração de e-mail |
| `theme-config.ts` | Salvar configurações de aparência |
| `test-email.ts` | Enviar e-mail de teste |
| `setup.ts` | Setup Wizard (criação do owner) |
| `upload.ts` | Upload de arquivos (logos, avatares) |
| `audit.ts` | Consultas de auditoria |

---

### `lib/` — Funções Utilitárias
| Arquivo | Responsabilidade |
|---------|-----------------|
| `db.ts` | Singleton do Prisma Client |
| `audit.ts` | Helper `logAudit()` para Event Sourcing |
| `permissions.ts` | Guard Code do RBAC: `can(userId, resource, action)` |
| `email.ts` | Gateway de envio unificado (SMTP/Resend) |
| `gerador-db.ts` | Pool `pg` somente leitura para o banco de telemetria do gerador (`leituras`, `falhas_coleta`) — separado do Prisma |

### `lib/auth/` — Módulos de Autenticação
| Arquivo | Responsabilidade |
|---------|-----------------|
| `session.ts` | Criar/validar/revogar sessões (cookie opaco `session_token`) |
| `password.ts` | Hash e verificação bcrypt |
| `oauth.ts` | Configs OAuth (Google, GitHub, Microsoft), token exchange, user info |
| `ldap.ts` | Conexão e autenticação LDAP/AD |
| `secrets.ts` | Encrypt/Decrypt AES-256-GCM |
| `tokens.ts` | Geração de tokens (password reset, email verification) |
| `rate-limit.ts` | Rate limiting por IP e por e-mail |
| `turnstile.ts` | Verificação Cloudflare Turnstile |
| `validations.ts` | Validação de políticas de senha |

---

### `scripts/` — Utilitários de linha de comando (gerador-web)
| Arquivo | Responsabilidade |
|---------|-----------------|
| `check-gerador-db.ts` | Verificação manual de conectividade com o banco de telemetria |

---

### `components/dashboard/` — Client Components
Padrão: `[rota]-client.tsx` gerencia estado, modais e transições.

| Componente | Rota que consome |
|-----------|-----------------|
| `users-client.tsx` | `/dashboard/users` |
| `roles-client.tsx` | `/dashboard/roles` |
| `invites-client.tsx` | `/dashboard/invites` |
| `sessions-client.tsx` | `/dashboard/sessions` |
| `audit-client.tsx` | `/dashboard/audit` |
| `profile-client.tsx` | `/dashboard/profile` |
| `auth-settings-client.tsx` | `/dashboard/settings/auth` |
| `email-settings-client.tsx` | `/dashboard/settings/email` |
| `appearance-settings-client.tsx` | `/dashboard/settings/appearance` |
| `security-settings-client.tsx` | `/dashboard/settings/security` |

---

## Dependências Sensíveis (⚠️ Onde ter cuidado)

1. **Wrappers (`withAuth` / `withPermission`)** — Envolvem **toda** Server Action. Se alguma action for criada fora do wrapper, ela vaza dados (embora o script de build `test-actions.ts` agora impeça isso).
2. **`proxy.ts`** — Atua apenas como fallback de UX para redirecionar usuários não autenticados. **Não** confie nele para bloquear vazamento de dados, pois a proteção real está nos wrappers.
3. **Prisma Schema** — Ao adicionar campos/tabelas, manter compatibilidade com `AuditLog` e propagação de eventos.
4. **Cookie `session_token`** — Nome fixo. Se alterar em `session.ts`, atualizar actions de login/logout.
5. **Módulo Central de Criptografia (`secrets-config.ts`)** — Usa `AUTH_SECRET` do `.env`. Se rotacionar, manter `AUTH_SECRET_PREVIOUS` para decodificar dados existentes (LDAP, OAuth, SMTP, TOTP).

---

## Fluxo de Dependências

```
proxy.ts (Middleware)
  ↓ verifica cookie session_token
  ↓ redireciona se não autenticado
  
page.tsx (Server Component)
  ↓ chama validateSession()
  ↓ busca dados via Prisma
  ↓ passa props para Client Component
  
*-client.tsx (Client Component)
  ↓ gerencia estado local
  ↓ chama Server Actions
  ↓ renderiza UI interativa
  
actions/*.ts (Server Actions)
  ↓ valida sessão + permissões (RBAC)
  ↓ executa mutação via Prisma
  ↓ registra AuditLog
```
