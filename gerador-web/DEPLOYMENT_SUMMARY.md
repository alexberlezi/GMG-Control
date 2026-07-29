# 📦 Resumo de Deployment - Gerador Web

## Arquivos Criados para Produção

### 1. **DEPLOY_PRODUCAO.md** 📖
Guia completo de deployment passo-a-passo:
- Preparação do servidor
- Configuração Docker
- Setup PostgreSQL
- Nginx reverse proxy
- SSL/HTTPS com Let's Encrypt
- Cron jobs para alarmes
- Troubleshooting

**Usar quando:** Fazer deploy em servidor novo

---

### 2. **GRAFANA_TEMPERATURA_FIX.md** 🌡️
Correção do problema de temperatura no Grafana:
- Problema: Valores inválidos (32765, 32767, 65535, <34°C)
- Solução: Filtros SQL para queries
- Exemplos de queries corrigidas
- Passo a passo no Grafana
- Validação de dados

**Usar quando:** Corrigir gráficos de temperatura no Grafana

---

### 3. **PRE_DEPLOYMENT_CHECKLIST.md** ✅
Checklist de verificação antes/durante/após deploy:
- Pré-requisitos
- Variáveis de ambiente
- Banco de dados
- SSL/HTTPS
- Backups
- Monitoramento
- Troubleshooting
- Pós-deployment (semana 1)

**Usar quando:** Preparar e validar deployment

---

### 4. **deploy.sh** 🚀
Script bash automático de deployment:
- Backup automático
- Atualização de código (git)
- Build da aplicação
- Build Docker
- Aplicação de migrações
- Health checks
- Relatório final

**Usar quando:** Fazer deploy rápido em produção

Comando:
```bash
chmod +x deploy.sh
./deploy.sh prod
```

---

## 🎯 Fluxo Recomendado

### 1ª Vez (Setup Inicial)

```
1. Ler: DEPLOY_PRODUCAO.md
2. Preencher: PRE_DEPLOYMENT_CHECKLIST.md
3. Preparar servidor (SSH, Docker, PostgreSQL)
4. Copiar .env com variáveis de produção
5. Executar: ./deploy.sh prod
6. Verificar: GRAFANA_TEMPERATURA_FIX.md
7. Configurar: Cron job de alarmes
```

### Atualizações Futuras (Fácil)

```
1. Atualizar código: git pull
2. Executar: ./deploy.sh prod
3. Pronto! (script faz tudo automaticamente)
```

---

## 📋 Arquivos por Responsabilidade

| Documento | Responsável | Frequência |
|-----------|------------|-----------|
| DEPLOY_PRODUCAO.md | DevOps/SysAdmin | Consultar uma vez |
| GRAFANA_TEMPERATURA_FIX.md | Admin/Operação | Implementar uma vez |
| PRE_DEPLOYMENT_CHECKLIST.md | DevOps/PM | Antes de cada deploy |
| deploy.sh | DevOps/CI-CD | Cada atualização |
| ALARMES_SETUP.md | Backend | Integração com gerador-monitor |

---

## 🔑 Variáveis de Ambiente Necessárias

```env
# Obrigatórias
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
GERADOR_DB_HOST=localhost
GERADOR_DB_PORT=5433
GERADOR_DB_NAME=gerador_telemetria
GERADOR_DB_USER=user
GERADOR_DB_PASSWORD=pass
GERADOR_API_KEY=chave_secreta_forte
JWT_SECRET=chave_jwt_forte
NEXTAUTH_SECRET=chave_nextauth_forte
NEXTAUTH_URL=https://seu-dominio.com

# Opcionais (Email)
SMTP_HOST=smtp.server.com
SMTP_PORT=587
SMTP_USER=email@server.com
SMTP_PASSWORD=pass
SMTP_FROM=noreply@server.com
```

---

## 🔍 Health Check Rápido

```bash
# 1. Containers rodando
docker-compose ps

# 2. API respondendo
curl http://localhost:3001/api/gerador/alarmes/detect

# 3. Dashboard acessível
curl http://localhost:3001/dashboard

# 4. Banco conectado
docker-compose exec postgres-web psql -U postgres -c "SELECT 1;"

# 5. Alarmes funcionando
curl -X POST http://localhost:3001/api/gerador/alarmes/detect \
  -H "X-API-Key: sua_chave"

# 6. Status dos logs
docker-compose logs --tail=50 web
```

---

## 📊 Sistema Completo (Visão Geral)

```
┌─────────────────────────────────────────────────────────┐
│              GERADOR WEB - PRODUÇÃO                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  🌐 NGINX (Proxy Reverso)                               │
│     ├── HTTP → HTTPS                                    │
│     └── :80 / :443                                      │
│                                                           │
│  📱 Next.js Application                                 │
│     ├── :3001                                           │
│     ├── Dashboard (/dashboard)                          │
│     ├── Painel Gerador (/dashboard/gerador)            │
│     ├── Alarmes (/dashboard/gerador/alarmes)           │
│     └── API (/api/gerador/alarmes/detect)              │
│                                                           │
│  🗄️ PostgreSQL Principal                               │
│     ├── Users (Auth)                                    │
│     ├── Alarms (Alarmes)                                │
│     ├── Maintenance (Manutenções)                       │
│     └── Audit Logs                                      │
│                                                           │
│  📡 PostgreSQL Telemetria (Externo)                     │
│     └── Leituras do Gerador                             │
│                                                           │
│  📊 Grafana (Externo)                                   │
│     ├── Dashboards                                      │
│     ├── Alertas                                         │
│     └── Queries com Filtro de Temperatura               │
│                                                           │
│  ⏰ Cron Jobs                                            │
│     └── Detecção de Alarmes (a cada 5 min)             │
│     └── Backup do Banco (diário)                        │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Comandos Úteis em Produção

```bash
# Ver status
docker-compose ps
docker stats

# Ver logs
docker-compose logs -f web
docker-compose logs -f postgres-web

# Restart de um serviço
docker-compose restart web

# Atualizar (fácil)
./deploy.sh prod

# Backup manual
docker-compose exec postgres-web pg_dump -U postgres gerador_web > backup.sql

# Restaurar backup
docker-compose exec -T postgres-web psql -U postgres gerador_web < backup.sql

# Verificar migrações
docker-compose exec web npx prisma migrate status

# Acessar banco
docker-compose exec postgres-web psql -U postgres -d gerador_web
```

---

## ⚠️ Checklist de Segurança

- [ ] SSL certificado válido (HTTPS)
- [ ] Senhas strong (mínimo 16 caracteres)
- [ ] .env não commitado no git
- [ ] Backup diário funcionando
- [ ] Logs habilitados e monitorados
- [ ] API Key segura (GERADOR_API_KEY)
- [ ] Firewall configurado (portas 80, 443 apenas)
- [ ] Usuário de aplicação sem privilégios de root
- [ ] SSH configurado com chave (sem senha)
- [ ] Rate limiting configurado no Nginx

---

## 📞 Suporte Rápido

**Problema → Solução:**

| Problema | Comando |
|----------|---------|
| App não inicia | `docker-compose logs web` |
| Banco não conecta | Verificar `DATABASE_URL` |
| Alarmes não funcionam | POST `/api/gerador/alarmes/detect` |
| Temperatura com picos | Aplicar filtro no Grafana |
| Memory leak | `docker-compose restart web` |
| SSL inválido | `sudo certbot renew` |
| Backup falho | Verificar `/opt/gerador-web/backups/` |

---

## 🎓 Próximos Passos (Após Deploy)

1. **Integração com Gerador-Monitor**
   - Configurar cron job no gerador-monitor
   - Chamar `/api/gerador/alarmes/detect` a cada 5 min

2. **Notificações**
   - Configurar SMTP para emails
   - Adicionar notificações para alarmes críticos

3. **Backup Automático**
   - Verificar cron job de backup
   - Testar restore

4. **Monitoramento**
   - Configurar alertas no Grafana
   - Aplicar filtro de temperatura

5. **Otimização**
   - Analizar performance
   - Ajustar recursos (CPU/Memory)
   - Cache no Nginx

---

**🎉 Parabéns! Sistema pronto para produção!**

Para dúvidas: Consulte os arquivos `.md` específicos ou os logs via `docker-compose logs -f`
