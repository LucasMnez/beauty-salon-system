#!/bin/bash

# Script de Deploy para Railway.app
# Este script ajuda a configurar o projeto no Railway

set -e

echo "🚀 Configurando deploy para Railway.app"
echo "========================================"
echo ""

# Verificar se Railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo "⚠️  Railway CLI não encontrado!"
    echo ""
    echo "Instale com:"
    echo "  npm i -g @railway/cli"
    echo ""
    echo "Ou faça o deploy via interface web:"
    echo "  1. Acesse https://railway.app"
    echo "  2. Clique em 'New Project'"
    echo "  3. Selecione 'Deploy from GitHub repo'"
    echo "  4. Escolha este repositório"
    echo "  5. Railway detectará automaticamente o Procfile"
    echo ""
    exit 1
fi

echo "✅ Railway CLI encontrado"
echo ""

# Verificar se está logado
if ! railway whoami &> /dev/null; then
    echo "🔐 Fazendo login no Railway..."
    railway login
fi

echo ""
echo "📋 Passos para deploy:"
echo ""
echo "1. Criar novo projeto no Railway:"
echo "   railway init"
echo ""
echo "2. Adicionar variáveis de ambiente:"
echo "   railway variables set FLASK_ENV=production"
echo "   railway variables set PORT=5000"
echo "   railway variables set ADMIN_USERNAME=raissa"
echo "   railway variables set ADMIN_PASSWORD_HASH=<hash-da-senha>"
echo "   railway variables set WHATSAPP_BOT_URL=http://localhost:3001"
echo ""
echo "3. Criar serviço para o bot WhatsApp (worker):"
echo "   railway service create whatsapp-bot"
echo "   railway service --service whatsapp-bot"
echo "   railway variables set NODE_ENV=production"
echo ""
echo "4. Fazer deploy:"
echo "   railway up"
echo ""
echo "📚 Documentação completa: https://docs.railway.app"
echo ""
