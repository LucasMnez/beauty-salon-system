# 🚀 GUIA COMPLETO DE INSTALAÇÃO - WhatsApp Bot

## ⚠️ PROBLEMA ATUAL

O bot não está funcionando porque:
1. **Dependências Node.js não instaladas corretamente**
2. **PM2 usando versão em cache do arquivo**
3. **Arquivo com shebang causando erro de sintaxe**
4. **Autenticação WhatsApp não configurada**

---

## 📋 PRÉ-REQUISITOS

### 1. Node.js instalado (versão 16+)
```bash
node --version
# Deve mostrar v16.x ou superior
```

Se não tiver Node.js:
```bash
# Instalar via nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

### 2. PM2 instalado globalmente
```bash
npm install -g pm2
```

### 3. Python 3.8+ instalado
```bash
python3 --version
```

---

## 🔧 INSTALAÇÃO PASSO A PASSO

### PASSO 1: Limpar tudo que está quebrado

```bash
cd /var/docker/apps/Agendamento

# Parar e remover o bot
pm2 stop whatsapp-bot 2>/dev/null || true
pm2 delete whatsapp-bot 2>/dev/null || true

# Remover autenticação antiga
rm -rf whatsapp_auth/

# Limpar cache do PM2
pm2 flush
```

### PASSO 2: Verificar e corrigir o arquivo whatsapp-bot.js

```bash
# Verificar se o arquivo está correto (NÃO deve ter shebang na linha 2)
head -5 whatsapp-bot.js

# Deve mostrar:
# /**
#  * Serviço WhatsApp Bot usando Baileys
#  * Envia mensagens automáticas quando agendamentos são criados
#  */
# 
```

**Se mostrar `#!/usr/bin/env node`, o arquivo está errado!**

### PASSO 3: Instalar dependências Node.js

```bash
# Garantir que está no diretório correto
cd /var/docker/apps/Agendamento

# Remover node_modules antigo (se existir)
rm -rf node_modules/

# Instalar dependências FRESCAS
npm install

# Verificar se instalou corretamente
ls node_modules/@whiskeysockets/baileys
# Deve mostrar a pasta baileys
```

### PASSO 4: Testar o arquivo diretamente com Node.js

```bash
# Testar se o arquivo funciona sem PM2
node whatsapp-bot.js
```

**O que deve acontecer:**
- ✅ Servidor inicia na porta 3001
- ✅ Mostra mensagem: "🚀 Servidor WhatsApp Bot rodando na porta 3001"
- ✅ Gera QR Code no terminal
- ❌ **NÃO deve mostrar erro de sintaxe**

**Se der erro de sintaxe:**
- O arquivo ainda tem problema
- Pare com Ctrl+C
- Execute: `head -5 whatsapp-bot.js` e me mostre o resultado

### PASSO 5: Iniciar com PM2

```bash
# Parar o teste anterior (Ctrl+C se ainda estiver rodando)

# Iniciar com PM2
pm2 start whatsapp-bot.js --name whatsapp-bot

# Ver status
pm2 status

# Ver logs
pm2 logs whatsapp-bot
```

**O que deve aparecer nos logs:**
- ✅ "🚀 Servidor WhatsApp Bot rodando na porta 3001"
- ✅ QR Code no terminal
- ✅ "📱 Escaneie o QR Code abaixo com seu WhatsApp:"
- ❌ **NÃO deve mostrar erro de sintaxe**

### PASSO 6: Escanear QR Code

1. Abra o WhatsApp no celular
2. Vá em **Configurações > Aparelhos conectados > Conectar um aparelho**
3. Escaneie o QR Code que aparece nos logs
4. Aguarde: `✅ Conectado ao WhatsApp com sucesso!`

### PASSO 7: Verificar se está funcionando

```bash
# Verificar status da conexão
curl http://localhost:3001/status

# Deve retornar:
# {"connected":true,"message":"WhatsApp conectado e pronto"}
```

---

## 🔗 CONFIGURAÇÃO NO FLASK (app.py)

O Flask precisa saber onde está o bot WhatsApp. Verifique se tem estas variáveis no `app.py`:

```python
# URL do bot WhatsApp
WHATSAPP_BOT_URL = 'http://localhost:3001'
WHATSAPP_RAISSA = '5511993940514'  # Número da Raissa
ENVIAR_WHATSAPP_AUTO = True  # Ativar notificações automáticas
```

---

## 🧪 TESTAR ENVIO DE MENSAGEM

```bash
# Testar envio manual
npm test

# Ou testar via curl
curl -X POST http://localhost:3001/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "5511993940514",
    "message": "Teste de mensagem automática"
  }'
```

---

## 🐛 RESOLUÇÃO DE PROBLEMAS

### Erro: "SyntaxError: Invalid or unexpected token"
**Causa:** Arquivo tem shebang `#!/usr/bin/env node`  
**Solução:** O arquivo `whatsapp-bot.js` NÃO deve ter shebang. Deve começar com `/**`

### Erro: "MODULE_NOT_FOUND"
**Causa:** Dependências não instaladas  
**Solução:** Execute `npm install` novamente

### Erro: "Connection Failure" (Status 405)
**Causa:** Autenticação expirada  
**Solução:** 
```bash
rm -rf whatsapp_auth/
pm2 restart whatsapp-bot
# Escaneie o novo QR Code
```

### Bot não cria pasta whatsapp_auth
**Causa:** Erro ao iniciar impede criação da pasta  
**Solução:** 
1. Verifique se o arquivo está correto (sem shebang)
2. Teste com `node whatsapp-bot.js` primeiro
3. Se funcionar, inicie com PM2

### PM2 mostra versão antiga do arquivo
**Causa:** Cache do PM2  
**Solução:**
```bash
pm2 delete whatsapp-bot
pm2 flush
pm2 start whatsapp-bot.js --name whatsapp-bot
```

---

## 📝 CHECKLIST FINAL

Antes de considerar que está funcionando, verifique:

- [ ] Node.js instalado (`node --version`)
- [ ] PM2 instalado (`pm2 --version`)
- [ ] Dependências instaladas (`ls node_modules/@whiskeysockets/baileys`)
- [ ] Arquivo `whatsapp-bot.js` SEM shebang (começa com `/**`)
- [ ] Arquivo funciona com `node whatsapp-bot.js`
- [ ] PM2 inicia sem erros (`pm2 logs whatsapp-bot`)
- [ ] QR Code aparece nos logs
- [ ] QR Code escaneado com sucesso
- [ ] Status retorna `{"connected":true}`
- [ ] Teste de envio funciona (`npm test`)

---

## 🆘 SE NADA FUNCIONAR

Execute este script completo de diagnóstico:

```bash
cd /var/docker/apps/Agendamento

echo "=== DIAGNÓSTICO COMPLETO ==="
echo ""
echo "1. Node.js:"
node --version
echo ""
echo "2. PM2:"
pm2 --version
echo ""
echo "3. Arquivo whatsapp-bot.js (primeiras 5 linhas):"
head -5 whatsapp-bot.js
echo ""
echo "4. Dependências instaladas:"
ls node_modules/@whiskeysockets/baileys 2>/dev/null && echo "✅ Baileys instalado" || echo "❌ Baileys NÃO instalado"
echo ""
echo "5. Status PM2:"
pm2 status
echo ""
echo "6. Teste direto com Node.js:"
timeout 5 node whatsapp-bot.js 2>&1 | head -10 || echo "Erro ao executar"
```

Envie o resultado completo para análise.
