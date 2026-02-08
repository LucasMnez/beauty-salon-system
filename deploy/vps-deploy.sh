#!/bin/bash

# Script de Deploy para VPS
# Execute este script após o vps-setup.sh

set -e

APP_USER="raissa-app"
APP_DIR="/var/www/raissa-nails"
SERVICE_NAME="raissa-nails"
DOMAIN="${1:-seu-dominio.com}"  # Passar domínio como primeiro argumento

echo "🚀 Fazendo deploy de Raissa Nails Beauty"
echo "=========================================="
echo "Domínio: $DOMAIN"
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Por favor, execute como root: sudo bash vps-deploy.sh seu-dominio.com"
    exit 1
fi

# Verificar se o diretório existe
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Diretório $APP_DIR não encontrado!"
    echo "Execute primeiro: sudo bash deploy/vps-setup.sh"
    exit 1
fi

cd "$APP_DIR"

# Verificar se é um repositório git
if [ ! -d ".git" ]; then
    echo "⚠️  Diretório não é um repositório git"
    echo "Por favor, clone o repositório primeiro:"
    echo "  git clone <seu-repositorio> $APP_DIR"
    exit 1
fi

# Atualizar código
echo "📥 Atualizando código..."
sudo -u "$APP_USER" git pull origin main || git pull origin master

# Instalar dependências Python
echo "📦 Instalando dependências Python..."
cd "$APP_DIR/backend"
sudo -u "$APP_USER" python3 -m venv venv || true
sudo -u "$APP_USER" "$APP_DIR/backend/venv/bin/pip" install --upgrade pip -q
sudo -u "$APP_USER" "$APP_DIR/backend/venv/bin/pip" install -r requirements.txt -q

# Instalar dependências Node.js
echo "📦 Instalando dependências Node.js..."
sudo -u "$APP_USER" npm install --production --silent

# Criar arquivo .env se não existir
if [ ! -f "$APP_DIR/backend/.env" ]; then
    echo "📝 Criando arquivo .env..."
    cat > "$APP_DIR/backend/.env" << EOF
FLASK_ENV=production
PORT=5000
SECRET_KEY=$(openssl rand -hex 32)
ADMIN_USERNAME=raissa
ADMIN_PASSWORD_HASH=$(python3 -c "import hashlib; print(hashlib.sha256(('Raissa123!' + 'raissa_nails_salt_2024').encode()).hexdigest())")
WHATSAPP_BOT_URL=http://localhost:3001
ENVIAR_WHATSAPP_AUTO=true
DB_NAME=$APP_DIR/backend/agendamento.db
EOF
    chown "$APP_USER:$APP_USER" "$APP_DIR/backend/.env"
    echo "⚠️  Arquivo .env criado com senha padrão. ALTERE A SENHA!"
fi

# Criar diretórios necessários
sudo -u "$APP_USER" mkdir -p "$APP_DIR/backend/whatsapp_auth"
sudo -u "$APP_USER" mkdir -p "$(dirname "$APP_DIR/backend/agendamento.db")"

# Criar script de inicialização
cat > "$APP_DIR/backend/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
export $(cat .env | xargs)
python3 app.py
EOF
chmod +x "$APP_DIR/backend/start.sh"
chown "$APP_USER:$APP_USER" "$APP_DIR/backend/start.sh"

# Configurar PM2 para Flask
echo "⚙️  Configurando PM2 para Flask..."
sudo -u "$APP_USER" pm2 delete "$SERVICE_NAME-backend" 2>/dev/null || true
sudo -u "$APP_USER" pm2 start "$APP_DIR/backend/start.sh" \
    --name "$SERVICE_NAME-backend" \
    --cwd "$APP_DIR/backend" \
    --interpreter bash \
    --log "$APP_DIR/logs/backend.log" \
    --error "$APP_DIR/logs/backend-error.log" \
    --out "$APP_DIR/logs/backend-out.log"

# Configurar PM2 para WhatsApp Bot
echo "⚙️  Configurando PM2 para WhatsApp Bot..."
sudo -u "$APP_USER" pm2 delete "$SERVICE_NAME-whatsapp" 2>/dev/null || true
sudo -u "$APP_USER" pm2 start "$APP_DIR/backend/whatsapp-bot.js" \
    --name "$SERVICE_NAME-whatsapp" \
    --cwd "$APP_DIR/backend" \
    --log "$APP_DIR/logs/whatsapp.log" \
    --error "$APP_DIR/logs/whatsapp-error.log" \
    --out "$APP_DIR/logs/whatsapp-out.log"

# Salvar configuração PM2
sudo -u "$APP_USER" pm2 save

# Configurar PM2 para iniciar no boot
sudo -u "$APP_USER" pm2 startup systemd -u "$APP_USER" --hp /home/"$APP_USER" | grep -v "PM2" | bash || true

# Criar diretório de logs
mkdir -p "$APP_DIR/logs"
chown "$APP_USER:$APP_USER" "$APP_DIR/logs"

# Configurar Nginx
echo "⚙️  Configurando Nginx..."
cat > "/etc/nginx/sites-available/$SERVICE_NAME" << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /static {
        alias $APP_DIR/frontend;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Habilitar site
ln -sf "/etc/nginx/sites-available/$SERVICE_NAME" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Testar configuração Nginx
nginx -t

# Recarregar Nginx
systemctl reload nginx

# Configurar SSL com Let's Encrypt
if [ "$DOMAIN" != "seu-dominio.com" ]; then
    echo "🔒 Configurando SSL..."
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" || echo "⚠️  Falha ao configurar SSL. Configure manualmente depois."
fi

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📋 Informações:"
echo "   - Aplicação rodando em: http://$DOMAIN"
echo "   - Logs Flask: pm2 logs $SERVICE_NAME-backend"
echo "   - Logs WhatsApp: pm2 logs $SERVICE_NAME-whatsapp"
echo "   - Reiniciar: pm2 restart all"
echo "   - Status: pm2 status"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   1. Altere a senha do admin no arquivo .env"
echo "   2. Configure o domínio DNS apontando para este servidor"
echo "   3. Acesse http://$DOMAIN/admin.html para configurar"
echo ""
