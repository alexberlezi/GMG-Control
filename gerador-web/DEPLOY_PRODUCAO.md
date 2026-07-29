# Guia de Deployment em Produção

## Pré-requisitos

- ✅ SSH acesso ao servidor
- ✅ Docker e Docker Compose instalados
- ✅ PostgreSQL 16+ rodando
- ✅ Banco de telemetria do gerador disponível
- ✅ Ports 80/443 disponíveis (ou redirecionados)

## 1. Preparação do Servidor

### 1.1 Clonar Repositório

```bash
cd /opt
sudo git clone https://seu-repo/gerador-web.git
cd gerador-web
```

### 1.2 Criar Arquivo .env

```bash
sudo nano .env
```

Adicionar as seguintes variáveis:

```env
# Node
NODE_ENV=production

# Database Principal (Auth/Alarmes/Manutenção)
DATABASE_URL="postgresql://postgres:SENHA@localhost:5432/gerador_web"

# Gerador Telemetria DB (dados de sensor)
GERADOR_DB_HOST=localhost
GERADOR_DB_PORT=5433
GERADOR_DB_NAME=gerador_telemetria
GERADOR_DB_USER=gerador_user
GERADOR_DB_PASSWORD=SENHA_TELEMETRIA

# Segurança
GERADOR_API_KEY=sua_chave_secreta_bem_forte_aqui
JWT_SECRET=outra_chave_secreta_bem_forte

# Aplicação
NEXTAUTH_SECRET=chave_nextauth_bem_forte
NEXTAUTH_URL=https://seu-dominio.com

# Email (opcional, para notificações)
SMTP_HOST=smtp.seuservidor.com
SMTP_PORT=587
SMTP_USER=seu-email@seuservidor.com
SMTP_PASSWORD=senha-email
SMTP_FROM=noreply@seuservidor.com
```

### 1.3 Definir Permissões

```bash
sudo chown -R usuario:usuario /opt/gerador-web
chmod -R 755 /opt/gerador-web
```

## 2. Configuração Docker

### 2.1 Editar docker-compose.yml para Produção

```yaml
# Backup do original
cp docker-compose.yml docker-compose.yml.bak

# Editar para produção
nano docker-compose.yml
```

Alterações para produção:

```yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: gerador-web-prod
    restart: always  # Reiniciar se cair
    environment:
      - NODE_ENV=production
    env_file: .env
    ports:
      - "127.0.0.1:3000:3000"  # Apenas localhost, usar nginx como proxy
    depends_on:
      - postgres-web
    networks:
      - gerador-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres-web:
    image: postgres:16-alpine
    container_name: postgres-gerador-prod
    restart: always
    environment:
      POSTGRES_DB: gerador_web
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - gerador-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local

networks:
  gerador-network:
    driver: bridge
```

### 2.2 Build e Deploy

```bash
# Build imagem
docker-compose build

# Iniciar containers
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f web
```

## 3. Migrações do Banco

```bash
# Aplicar migrações
docker-compose exec web npx prisma migrate deploy

# Verificar status
docker-compose exec web npx prisma migrate status
```

## 4. Nginx Reverse Proxy (Recomendado)

### 4.1 Instalar Nginx

```bash
sudo apt-get update
sudo apt-get install nginx

sudo systemctl start nginx
sudo systemctl enable nginx
```

### 4.2 Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/gerador-web
```

```nginx
upstream gerador_web {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;
    
    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com www.seu-dominio.com;
    
    # SSL (usar Let's Encrypt com Certbot)
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Logs
    access_log /var/log/nginx/gerador-web-access.log;
    error_log /var/log/nginx/gerador-web-error.log;
    
    # Proxy
    location / {
        proxy_pass http://gerador_web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4.3 Ativar Site

```bash
sudo ln -s /etc/nginx/sites-available/gerador-web /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar
sudo systemctl reload nginx
```

### 4.4 SSL com Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx

sudo certbot certonly --nginx -d seu-dominio.com -d www.seu-dominio.com
```

## 5. Cron Job para Detecção de Alarmes

### 5.1 Criar Script

```bash
sudo nano /usr/local/bin/detectar-alarmes.sh
```

```bash
#!/bin/bash

# Script para detectar alarmes a cada 5 minutos
GERADOR_API_KEY="sua_chave_secreta"
WEBHOOK_URL="http://localhost:3001/api/gerador/alarmes/detect"

curl -X POST $WEBHOOK_URL \
  -H "X-API-Key: $GERADOR_API_KEY" \
  -H "Content-Type: application/json" \
  >> /var/log/gerador-alarmes.log 2>&1
```

### 5.2 Tornar Executável

```bash
sudo chmod +x /usr/local/bin/detectar-alarmes.sh
```

### 5.3 Adicionar ao Crontab

```bash
sudo crontab -e
```

Adicionar:

```cron
# Detecção de alarmes a cada 5 minutos
*/5 * * * * /usr/local/bin/detectar-alarmes.sh

# Backup do banco diário às 3 da manhã
0 3 * * * docker-compose -f /opt/gerador-web/docker-compose.yml exec -T postgres-web pg_dump -U postgres gerador_web > /opt/gerador-web/backups/backup-$(date +\%Y-\%m-\%d).sql
```

## 6. Monitoramento e Manutenção

### 6.1 Verificar Saúde

```bash
# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f web

# Ver uso de recursos
docker stats
```

### 6.2 Backups

```bash
# Backup manual
docker-compose exec postgres-web pg_dump -U postgres gerador_web > backup.sql

# Restaurar
docker-compose exec -T postgres-web psql -U postgres gerador_web < backup.sql
```

### 6.3 Atualizar Código

```bash
# Pull do repositório
git pull origin main

# Rebuild
docker-compose build

# Restart
docker-compose up -d

# Aplicar migrações se necessário
docker-compose exec web npx prisma migrate deploy
```

## 7. Checklist Pós-Deploy

- [ ] Dashboard acessível em https://seu-dominio.com
- [ ] Login funcionando
- [ ] Dados do gerador aparecem no painel
- [ ] Alarmes sendo detectados (testar /api/gerador/alarmes/detect)
- [ ] Página de alarmes carregando
- [ ] Gráficos do histórico exibindo
- [ ] Logs sem erros (docker-compose logs)
- [ ] SSL certificado válido (https)
- [ ] Nginx redireciona HTTP → HTTPS
- [ ] Cron job de alarmes rodando (verificar /var/log/gerador-alarmes.log)
- [ ] Backups sendo executados
- [ ] Email de notificações (se configurado)

## 8. Troubleshooting

### Container não inicia

```bash
docker-compose logs web
# Ver erro e corrigir .env
```

### Banco de dados não conecta

```bash
docker-compose exec postgres-web psql -U postgres -c "SELECT 1"
```

### Migrações falhando

```bash
docker-compose exec web npx prisma migrate resolve --rolled-back
docker-compose exec web npx prisma migrate deploy
```

### Permissões de arquivo

```bash
sudo chown -R 1000:1000 /opt/gerador-web
```

## Contato & Suporte

- Documentação: `/opt/gerador-web/README.md`
- Guia de Alarmes: `/opt/gerador-web/ALARMES_SETUP.md`
- Logs: `docker-compose logs -f`
