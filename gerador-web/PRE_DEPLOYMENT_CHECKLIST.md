# Checklist Pré-Deployment em Produção

## 📋 Antes de Fazer Deploy

### 1. Informações do Servidor 📍

- [ ] IP/Hostname do servidor anotado: ______________
- [ ] Credenciais SSH prontas
- [ ] Portas liberadas: 80, 443, 3001
- [ ] Docker e Docker Compose instalados
- [ ] PostgreSQL disponível (local ou remoto)

### 2. Variáveis de Ambiente 🔐

Arquivo `.env` configurado com:

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` - Banco principal (gerador_web)
- [ ] `GERADOR_DB_HOST` - Banco telemetria
- [ ] `GERADOR_DB_PORT` - Porta banco telemetria
- [ ] `GERADOR_DB_NAME` - Nome banco telemetria
- [ ] `GERADOR_DB_USER` - Usuário banco telemetria
- [ ] `GERADOR_DB_PASSWORD` - Senha banco telemetria
- [ ] `GERADOR_API_KEY` - Chave para API alarmes (gerada)
- [ ] `JWT_SECRET` - Chave JWT (gerada)
- [ ] `NEXTAUTH_SECRET` - Chave NextAuth (gerada)
- [ ] `NEXTAUTH_URL` - URL do domínio
- [ ] SMTP configurado (opcional, para emails)

**Gerar chaves seguras:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Banco de Dados 🗄️

**Banco Principal (gerador_web):**
- [ ] PostgreSQL 16+ criado
- [ ] Usuário `postgres` com senha definida
- [ ] Backup antes de aplicar migrações

**Banco Telemetria:**
- [ ] Banco `gerador_telemetria` criado
- [ ] Usuário `gerador_user` criado
- [ ] Testada conexão de `gerador-web` para banco telemetria

Testar conexão:
```bash
psql -h localhost -U postgres -d gerador_web -c "SELECT 1;"
psql -h localhost -U gerador_user -d gerador_telemetria -c "SELECT 1;"
```

### 4. SSL/HTTPS 🔒

- [ ] Domínio apontando para IP do servidor
- [ ] Certificado SSL válido (Let's Encrypt recomendado)
- [ ] Nginx instalado e configurado como proxy reverso
- [ ] Redirecionar HTTP → HTTPS

### 5. Arquivos de Configuração ⚙️

- [ ] `.env` preparado
- [ ] `docker-compose.yml` revisado para produção
- [ ] `nginx.conf` configurado
- [ ] Logs serão salvos em `/var/log/gerador/`

### 6. Backups e Recuperação 💾

- [ ] Plano de backup definido (diário recomendado)
- [ ] Local de backup definido (`/opt/gerador-web/backups/`)
- [ ] Testado restore de backup
- [ ] Retenção de backups definida (mínimo 30 dias)

### 7. Monitoramento 📊

- [ ] Grafana acesso configurado
- [ ] Queries de temperatura corrigidas (filtro 32765, 32767, 65535, <34)
- [ ] Alertas de alarmes críticos configurados
- [ ] Histórico de logs habilitado

### 8. Integração com Gerador-Monitor 🔄

- [ ] `GERADOR_API_KEY` compartilhada com gerador-monitor
- [ ] Cron job para detecção de alarmes a cada 5 minutos configurado
- [ ] Testado endpoint POST `/api/gerador/alarmes/detect`

### 9. Notificações 📧

- [ ] SMTP configurado (se desejado)
- [ ] Email de teste enviado com sucesso
- [ ] Notificações para alarmes críticos ativadas (opcional)

### 10. Documentação 📚

- [ ] `DEPLOY_PRODUCAO.md` lido e entendido
- [ ] `ALARMES_SETUP.md` lido e entendido
- [ ] `GRAFANA_TEMPERATURA_FIX.md` lido e entendido
- [ ] Contatos de suporte anotados

---

## 🚀 Durante o Deployment

### Passo 1: Preparar Servidor

```bash
# SSH no servidor
ssh usuario@seu-servidor.com

# Clonar repositório
cd /opt
sudo git clone https://seu-repo/gerador-web.git
cd gerador-web

# Copiar .env
sudo nano .env
# Adicionar variáveis de produção

# Definir permissões
sudo chown -R usuario:usuario .
chmod -R 755 .
```

### Passo 2: Executar Deploy Script

```bash
# Tornar executável
chmod +x deploy.sh

# Executar (escolher ambiente)
./deploy.sh prod

# Ou manualmente
docker-compose build
docker-compose up -d
docker-compose exec web npx prisma migrate deploy
```

### Passo 3: Verificações Pós-Deploy

```bash
# Ver status
docker-compose ps

# Ver logs
docker-compose logs -f web

# Testar API
curl http://localhost:3001/dashboard

# Testar Alarmes
curl -X POST http://localhost:3001/api/gerador/alarmes/detect \
  -H "X-API-Key: sua_chave" \
  -H "Content-Type: application/json"

# Ver usage
docker stats
```

### Passo 4: Validar Aplicação

- [ ] Acessar dashboard em https://seu-dominio.com
- [ ] Login funciona
- [ ] Dados do gerador aparecem
- [ ] Gráficos carregam
- [ ] Página de alarmes acessível
- [ ] Sem erros nos logs

### Passo 5: Configurar Monitoramento

```bash
# Grafana
docker exec postgres-web psql -U postgres -d gerador_web -c "SELECT COUNT(*) FROM \"AlarmeGerador\";"

# Cron job
sudo crontab -e
# Adicionar:
# */5 * * * * /usr/local/bin/detectar-alarmes.sh

# Verificar logs
tail -f /var/log/gerador-alarmes.log
```

---

## ✅ Pós-Deployment (Dia 1)

### Monitoramento

- [ ] Verificar logs a cada hora
- [ ] Nenhum erro no docker-compose logs
- [ ] Alarmes estão sendo detectados
- [ ] Cron job rodando (verificar /var/log/gerador-alarmes.log)

### Segurança

- [ ] SSL certificado válido (verificar com curl)
- [ ] Senha de administrador alterada
- [ ] Backup do banco executado
- [ ] Nenhuma porta desnecessária aberta

### Performance

- [ ] Dashboard carrega em < 2s
- [ ] Gráficos renderizam rápido
- [ ] API responde em < 500ms
- [ ] CPU/Memória dentro do esperado (docker stats)

### Dados

- [ ] Dados do gerador sincronizando
- [ ] Temperatura filtrando valores inválidos
- [ ] Histórico aparecendo
- [ ] Alarmes criados/resolvidos corretamente

---

## ⚠️ Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| Containers não iniciam | `docker-compose logs web` |
| Banco não conecta | Verificar `DATABASE_URL` no `.env` |
| Migrações falham | `docker-compose exec web npx prisma migrate status` |
| Alarmes não aparecem | POST para `/api/gerador/alarmes/detect` com header `X-API-Key` |
| SSL error | Renovar certificado: `sudo certbot renew` |
| Memory leak | Reiniciar containers: `docker-compose restart web` |
| Temperatura com picos | Aplicar filtro no Grafana (ver `GRAFANA_TEMPERATURA_FIX.md`) |

---

## 📞 Contatos & Suporte

- **Documentação**: Pasta `/opt/gerador-web/`
- **Logs**: `docker-compose logs -f`
- **Backup**: `/opt/gerador-web/backups/`
- **Nginx**: `/etc/nginx/sites-available/gerador-web`
- **Cron**: `sudo crontab -e`

---

## 📅 Checklist Pós-1 Semana

- [ ] Nenhum erro nos logs últimos 7 dias
- [ ] Backup diário funcionando
- [ ] Alarmes precisos (sem falsos positivos)
- [ ] Performance estável
- [ ] Usuários conseguindo logar e usar
- [ ] Temperatura mostrando valores corretos

---

**Status Final:** ✅ Pronto para Produção

Quando completar todos os itens, o sistema está pronto para operação normal.
