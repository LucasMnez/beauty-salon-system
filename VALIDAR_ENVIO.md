# Como Validar se o Envio WhatsApp Está Funcionando

## 1. Verificar se o Bot Está Conectado

```bash
curl http://localhost:3001/status
```

**Resposta esperada:**
```json
{
  "connected": true,
  "message": "WhatsApp conectado e pronto"
}
```

Se `connected: false`, você precisa:
- Verificar os logs: `pm2 logs whatsapp-bot`
- Escanear o QR Code novamente se necessário

## 2. Testar Envio Manual

Execute o script de teste:

```bash
npm test
```

Ou teste manualmente:

```bash
curl -X POST http://localhost:3001/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "5511993940514",
    "message": "🧪 Teste de envio automático"
  }'
```

## 3. Verificar Logs em Tempo Real

### Logs do Bot WhatsApp:
```bash
pm2 logs whatsapp-bot --lines 50
```

### Logs do Flask (quando criar agendamento):
Os logs aparecerão no terminal onde o Flask está rodando, mostrando:
- ✅ Se a mensagem foi enviada com sucesso
- ❌ Se houve algum erro
- 📱 ID da mensagem enviada

## 4. Criar um Agendamento de Teste

1. Acesse a página de agendamento
2. Selecione uma data e horário
3. Preencha os dados
4. Crie o agendamento
5. **Verifique os logs do Flask** - você verá:
   ```
   📱 Enviando notificação WhatsApp para 5511993940514...
   🔗 URL do bot: http://localhost:3001/send-message
   ✅ Notificação WhatsApp enviada com sucesso!
      ID da mensagem: [ID_AQUI]
      Telefone: 5511993940514
   ```

## 5. Verificar no WhatsApp da Raissa

A mensagem deve aparecer automaticamente no WhatsApp da Raissa com:
- 🔔 NOVO AGENDAMENTO CRIADO
- Dados do cliente
- Data e horário
- Serviços selecionados
- Valor total

## Troubleshooting

### Bot não conecta
```bash
# Parar bot
pm2 stop whatsapp-bot

# Remover autenticação antiga (se necessário)
rm -rf whatsapp_auth/

# Reiniciar bot
pm2 start whatsapp-bot.js --name whatsapp-bot

# Ver logs
pm2 logs whatsapp-bot
```

### Erro 503 (Bot não conectado)
- Verifique se o bot está rodando: `pm2 list`
- Verifique se está conectado: `curl http://localhost:3001/status`
- Veja os logs: `pm2 logs whatsapp-bot`

### Erro de conexão
- Verifique se a porta 3001 está livre
- Verifique se o Flask está chamando a URL correta
- Verifique firewall/antivírus

### Mensagem não chega
1. Verifique os logs do bot: `pm2 logs whatsapp-bot`
2. Verifique os logs do Flask (quando criar agendamento)
3. Verifique se o número está correto no `app.py`: `WHATSAPP_RAISSA = '5511993940514'`
4. Teste manualmente com `npm test`

## Status de Validação

✅ **Tudo OK se:**
- `curl http://localhost:3001/status` retorna `"connected": true`
- `npm test` envia mensagem com sucesso
- Logs do Flask mostram `✅ Notificação WhatsApp enviada com sucesso!`
- Mensagem aparece no WhatsApp da Raissa

❌ **Problema se:**
- Status retorna `"connected": false`
- Erro 503 ao enviar
- Timeout na conexão
- Mensagem não aparece no WhatsApp
