#!/bin/bash

# Script de Setup Inicial para VPS
# Execute este script como root no seu VPS Ubuntu/Debian

set -e

echo "🚀 Configurando VPS para Raissa Nails Beauty"
echo "=============================================="
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Por favor, execute como root: sudo bash vps-setup.sh"
    exit 1
fi

# Atualizar sistema
echo "📦 Atualizando sistema..."
apt-get update -qq
apt-get upgrade -y -qq

# Instalar dependências básicas
echo "📦 Instalando dependências..."
apt-get install -y -qq \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    sqlite3 \
    supervisor \
    ufw \
    curl \
    wget

# Instalar Node.js 18+ via NodeSource (se necessário)
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "📦 Instalando Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y -qq nodejs
fi

# Instalar PM2 globalmente
echo "📦 Instalando PM2..."
npm install -g pm2

# Criar usuário para aplicação (se não existir)
APP_USER="raissa-app"
if ! id "$APP_USER" &>/dev/null; then
    echo "👤 Criando usuário $APP_USER..."
    useradd -m -s /bin/bash "$APP_USER"
fi

# Criar diretório da aplicação
APP_DIR="/var/www/raissa-nails"
echo "📁 Criando diretório da aplicação: $APP_DIR"
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# Configurar firewall
echo "🔥 Configurando firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force reload

echo ""
echo "✅ Setup inicial concluído!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Clone o repositório em $APP_DIR"
echo "   2. Execute: sudo bash deploy/vps-deploy.sh"
echo ""
