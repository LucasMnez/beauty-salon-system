# Instalar Dependências do WhatsApp Bot

## Erro Atual

O bot está dando erro `MODULE_NOT_FOUND` porque as dependências não foram instaladas.

## Solução

Execute no terminal WSL:

```bash
cd /var/docker/apps/Agendamento
npm install
```

Isso instalará:
- @whiskeysockets/baileys
- express
- qrcode-terminal
- pino
- @hapi/boom

## Depois de Instalar

Reinicie o bot:

```bash
pm2 restart whatsapp-bot
pm2 logs whatsapp-bot
```

Você deve ver:
- `🚀 Servidor WhatsApp Bot rodando na porta 3001`
- QR Code para escanear (se não estiver conectado)
- Ou `✅ Conectado ao WhatsApp com sucesso!` (se já estava conectado)

## Verificar se Funcionou

```bash
curl http://localhost:3001/status
```

Deve retornar:
```json
{"connected": true, "message": "WhatsApp conectado e pronto"}
```
