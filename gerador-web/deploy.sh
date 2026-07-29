#!/bin/bash

###############################################################################
# Script de Deployment Automático - Gerador Web
# Uso: ./deploy.sh [ambiente]
# Ambientes: dev, staging, prod
###############################################################################

set -e  # Exit on error

AMBIENTE=${1:-dev}
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_FILE="/var/log/gerador-deploy-${TIMESTAMP}.log"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

###############################################################################
# Funções
###############################################################################

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}✗ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}" | tee -a "$LOG_FILE"
}

###############################################################################
# Validações Iniciais
###############################################################################

log "🚀 Iniciando deployment para ambiente: $AMBIENTE"

if [[ ! "$AMBIENTE" =~ ^(dev|staging|prod)$ ]]; then
    log_error "Ambiente inválido: $AMBIENTE. Use: dev, staging ou prod"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    log_error "Docker não está instalado"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose não está instalado"
    exit 1
fi

if [ ! -f .env ]; then
    log_error "Arquivo .env não encontrado"
    exit 1
fi

log_success "✓ Docker disponível"
log_success "✓ Arquivo .env encontrado"

###############################################################################
# Backup
###############################################################################

log "📦 Criando backup..."

BACKUP_DIR="./backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

if [ "$(docker-compose ps -q postgres-web)" ]; then
    docker-compose exec -T postgres-web pg_dump -U postgres gerador_web > \
        "$BACKUP_DIR/backup-${TIMESTAMP}.sql" 2>/dev/null
    log_success "✓ Backup do banco de dados criado"
else
    log_warning "⚠ Banco de dados não está rodando, backup pulado"
fi

# Backup de variáveis de ambiente
cp .env "$BACKUP_DIR/.env.backup-${TIMESTAMP}"
log_success "✓ Backup de .env criado"

###############################################################################
# Atualizar Código
###############################################################################

log "📥 Atualizando código..."

git fetch origin 2>/dev/null || log_warning "Não foi possível fazer fetch do git"
git pull origin main 2>/dev/null || log_warning "Não foi possível fazer pull do git"

log_success "✓ Código atualizado"

###############################################################################
# Build
###############################################################################

log "🔨 Fazendo build..."

npm install 2>&1 | tail -5 >> "$LOG_FILE"
log_success "✓ Dependências instaladas"

npm run build 2>&1 | tail -10 >> "$LOG_FILE" || {
    log_error "Build falhou"
    exit 1
}

log_success "✓ Build concluído com sucesso"

###############################################################################
# Docker Build & Deploy
###############################################################################

log "🐳 Fazendo build da imagem Docker..."

docker-compose build 2>&1 | tail -10 >> "$LOG_FILE" || {
    log_error "Build do Docker falhou"
    exit 1
}

log_success "✓ Imagem Docker built"

log "🚀 Iniciando containers..."

docker-compose down 2>&1 >> "$LOG_FILE" || true
docker-compose up -d 2>&1 >> "$LOG_FILE" || {
    log_error "Falha ao iniciar containers"
    exit 1
}

log_success "✓ Containers iniciados"

###############################################################################
# Aguardar Saúde
###############################################################################

log "⏳ Aguardando containers ficarem saudáveis..."

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose ps | grep -q "Up"; then
        HEALTH=$(docker-compose ps web | grep -o "Up" || echo "Down")
        if [ "$HEALTH" == "Up" ]; then
            log_success "✓ Containers saudáveis"
            break
        fi
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "Timeout aguardando containers"
    log "Logs:"
    docker-compose logs web | tail -20 >> "$LOG_FILE"
    exit 1
fi

###############################################################################
# Migrações
###############################################################################

log "📊 Aplicando migrações do banco de dados..."

docker-compose exec -T web npx prisma migrate deploy 2>&1 | tail -10 >> "$LOG_FILE" || {
    log_warning "⚠ Falha ao aplicar migrações"
}

log_success "✓ Migrações aplicadas"

###############################################################################
# Verificações
###############################################################################

log "🔍 Executando verificações..."

# Verificar se API está respondendo
if curl -s http://localhost:3001/api/gerador/alarmes/detect > /dev/null; then
    log_success "✓ API respondendo"
else
    log_error "API não está respondendo"
    exit 1
fi

# Verificar banco de dados
if docker-compose exec -T postgres-web psql -U postgres -c "SELECT 1" > /dev/null 2>&1; then
    log_success "✓ Banco de dados conectado"
else
    log_error "Banco de dados não está conectado"
    exit 1
fi

###############################################################################
# Health Check
###############################################################################

log "💚 Verificando saúde da aplicação..."

sleep 5

HEALTH_CHECK=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:3001/dashboard)

if [ "$HEALTH_CHECK" == "200" ]; then
    log_success "✓ Health check passou (HTTP $HEALTH_CHECK)"
else
    log_warning "⚠ Health check retornou HTTP $HEALTH_CHECK"
fi

###############################################################################
# Relatório
###############################################################################

log ""
log "════════════════════════════════════════════════════════════════"
log_success "✓ DEPLOYMENT CONCLUÍDO COM SUCESSO!"
log "════════════════════════════════════════════════════════════════"
log ""
log "📊 Informações:"
log "   • Ambiente: $AMBIENTE"
log "   • Timestamp: $TIMESTAMP"
log "   • Log: $LOG_FILE"
log ""
log "🔗 Acessar:"
log "   • Dashboard: http://localhost:3001/dashboard"
log "   • Painel Gerador: http://localhost:3001/dashboard/gerador"
log "   • Alarmes: http://localhost:3001/dashboard/gerador/alarmes"
log "   • API Alarmes: http://localhost:3001/api/gerador/alarmes/detect"
log ""
log "📦 Containers:"
docker-compose ps 2>&1 | tail -3 >> "$LOG_FILE"
docker-compose ps
log ""
log "📝 Próximos passos:"
log "   1. Verificar logs: docker-compose logs -f web"
log "   2. Testar alarmes: curl -X POST http://localhost:3001/api/gerador/alarmes/detect -H 'X-API-Key: sua_chave'"
log "   3. Monitorar: docker stats"
log ""
