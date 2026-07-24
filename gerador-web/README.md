# AuthForge

AuthForge é um sistema de gerenciamento de identidade e acessos (Identity and Access Management — IAM) self-hosted. Criado em **Next.js 16+ (App Router)** com **Prisma ORM** e **PostgreSQL**, ele entrega recursos de segurança "Enterprise" de forma simples e visual.

## Funcionalidades

### 🔐 Autenticação Multi-Método
- **E-mail e Senha** — Login tradicional com validação de complexidade
- **Magic Link** — Login sem senha via link único enviado por e-mail (15 min de validade)
- **OAuth Social** — Login com Google, GitHub e Microsoft (Azure AD)
- **LDAP / Active Directory** — Autenticação direta no AD com auto-provisão de usuários
- **2FA (TOTP)** — Autenticação de dois fatores com Google Authenticator + 10 códigos de backup

### 👥 Gestão de Usuários
- CRUD completo com tabela e cards
- Convites por e-mail com expiração configurável
- Provisão automática via LDAP e OAuth
- Ativação/Desativação de contas

### 🛡️ RBAC (Controle de Acesso)
- Grupos (Roles) com permissões granulares por `recurso:ação`
- Grupo padrão configurável para novos usuários
- Permissão wildcard (`*:manage`) para SuperAdmin

### 📊 Auditoria & Sessões
- Event Sourcing simplificado: todas as ações críticas são logadas
- Gerenciamento de sessões com informações de dispositivo e IP
- Kill-Switch: revogação instantânea de sessões

### 🎨 White-Label
- Cores primária, secundária e accent personalizáveis
- Upload de logo (claro/escuro) e favicon
- 3 layouts de login: Centralizado, Split e Minimalista
- Tema claro/escuro com persistência

### 🔒 Políticas de Segurança
- Política de senhas: tamanho mínimo, maiúsculas, números, símbolos
- Defesa contra força bruta: bloqueio por IP + conta
- Tempo máximo de sessão configurável
- Cloudflare Turnstile (CAPTCHA invisível)
- Expiração de senhas

### ✉️ E-mail
- Suporte a SMTP e Resend
- Templates de e-mail para convites, Magic Link, reset de senha
- Teste de envio integrado no painel

---

## Configuração Local (Desenvolvimento)

### 1. Dependências
```bash
npm install
```

### 2. Banco de Dados (PostgreSQL)
Crie um arquivo `.env` baseado no `.env.example`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/authforge_dev"
AUTH_SECRET="gere-com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Subir as Tabelas
```bash
npx prisma db push
```

### 4. Rodar a Aplicação
```bash
npm run dev
```

### 5. Setup Wizard
Ao acessar `http://localhost:3000` pela primeira vez, o **Setup Wizard** é exibido automaticamente para criar o administrador (Owner), configurar métodos de autenticação e e-mail.

---

## Configuração OAuth (Opcional)

Para habilitar login social, configure as credenciais nos consoles dos provedores:

| Provedor | Console | Callback URL |
|----------|---------|-------------|
| Google | [Cloud Console](https://console.cloud.google.com/apis/credentials) | `/api/auth/callback/google` |
| GitHub | [Developer Settings](https://github.com/settings/developers) | `/api/auth/callback/github` |
| Microsoft | [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps) | `/api/auth/callback/microsoft` |

As credenciais podem ser configuradas via:
- **Painel Admin** → Autenticação → selecionar o provedor → Client ID / Client Secret
- **Variáveis de ambiente** no `.env` (fallback)

---

## Configuração LDAP (Opcional)

Configure diretamente no painel: **Configurações → Autenticação → LDAP / Active Directory**

Formatos suportados:
- **UPN**: `usuario@dominio.local`
- **DN completo**: `CN=Service Account,OU=Services,DC=dominio,DC=local`
- **IP direto**: `10.40.3.22` (porta 389 adicionada automaticamente)

---

## Documentação Técnica

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Fluxo de sessões, Server Actions e padrões de projeto
- [CODEBASE.md](./CODEBASE.md) — Mapeamento da estrutura de pastas e dependências
