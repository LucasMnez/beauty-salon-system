#!/bin/bash

# Script para verificar se há arquivos sensíveis antes do push

echo "🔒 Verificando segurança antes do push..."
echo ""

# Verificar arquivos sensíveis no staging
echo "📋 Arquivos no staging:"
git diff --cached --name-only | grep -E "\.(env|db|sqlite|key|pem|credentials)" && {
    echo "❌ ATENÇÃO: Arquivos sensíveis encontrados no staging!"
    echo "   Remova-os antes de fazer commit:"
    echo "   git reset HEAD <arquivo>"
    exit 1
} || echo "✅ Nenhum arquivo sensível no staging"

# Verificar arquivos sensíveis já commitados
echo ""
echo "📋 Verificando arquivos sensíveis já commitados..."
git ls-files | grep -E "\.(env|db|sqlite|key|pem|credentials)" && {
    echo "⚠️  ATENÇÃO: Arquivos sensíveis encontrados no repositório!"
    echo "   Considere removê-los do histórico:"
    echo "   git rm --cached <arquivo>"
    echo "   git commit -m 'Remove arquivos sensíveis'"
} || echo "✅ Nenhum arquivo sensível commitado"

# Verificar se .gitignore está atualizado
echo ""
echo "📋 Verificando .gitignore..."
grep -q "\.env" .gitignore && echo "✅ .env está no .gitignore" || echo "⚠️  .env NÃO está no .gitignore"
grep -q "\.db" .gitignore && echo "✅ .db está no .gitignore" || echo "⚠️  .db NÃO está no .gitignore"
grep -q "whatsapp_auth" .gitignore && echo "✅ whatsapp_auth está no .gitignore" || echo "⚠️  whatsapp_auth NÃO está no .gitignore"

# Verificar arquivos que serão commitados
echo ""
echo "📋 Arquivos que serão commitados:"
git status --short

echo ""
echo "✅ Verificação concluída!"
echo ""
echo "Para fazer push seguro:"
echo "  1. Verifique que nenhum arquivo sensível está listado acima"
echo "  2. git add ."
echo "  3. git commit -m 'Sua mensagem'"
echo "  4. git push -u origin main"
