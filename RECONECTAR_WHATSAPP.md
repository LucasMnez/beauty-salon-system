# Como Reconectar o WhatsApp Bot

## Problema: Erro 405 (Connection Failure)

O erro 405 geralmente significa que a autenticação expirou ou está inválida. Você precisa reconectar escaneando o QR Code novamente.

## Solução Passo a Passo

### 1. Parar o bot

```bash
pm2 stop whatsapp-bot
```

### 2. Remover autenticação antiga

```bash
rm -rf whatsapp_auth/
```

### 3. Reiniciar o bot

```bash
pm2 start whatsapp-bot.js --name whatsapp-bot
```

### 4. Ver os logs para obter o QR Code

```bash
pm2 logs whatsapp-bot
```

### 5. Escanear o QR Code

1. Abra o WhatsApp no seu celular
2. Vá em **Configurações > Aparelhos conectados > Conectar um aparelho**
3. Escaneie o QR Code que aparece nos logs
4. Aguarde a mensagem: `✅ Conectado ao WhatsApp com sucesso!`

## Verificar se Está Funcionando

```bash
curl http://localhost:3001/status
```

Deve retornar:
```json
{"connected": true, "message": "WhatsApp conectado e pronto"}
```

## Testar Envio

```bash
npm test
```

Isso enviará uma mensagem de teste para o WhatsApp da Raissa.

## Notas Importantes

- ⚠️ **Não compartilhe a pasta `whatsapp_auth/`** - ela contém suas credenciais
- 🔄 Se o bot desconectar, ele tentará reconectar automaticamente
- 📱 Mantenha o WhatsApp ativo no celular para evitar desconexões
- 🚫 Não use o mesmo WhatsApp em múltiplos dispositivos simultaneamente
