#!/bin/bash

echo "🔍 Testando conexão com a API..."
echo ""

# Testar portas comuns
for porta in 5000 5001 5002 5003; do
    echo "Testando porta $porta..."
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$porta/api/servicos" 2>/dev/null)
    if [ "$response" = "200" ]; then
        echo "✅ Porta $porta está respondendo!"
        echo "   Testando endpoint admin..."
        admin_response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$porta/api/admin/verify" 2>/dev/null)
        echo "   /api/admin/verify: $admin_response"
        break
    else
        echo "   ❌ Porta $porta não respondeu (código: $response)"
    fi
done

echo ""
echo "Para iniciar o servidor:"
echo "  cd backend && python3 app.py"
