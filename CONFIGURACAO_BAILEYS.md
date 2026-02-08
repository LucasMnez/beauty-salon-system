# Configuração WhatsApp Bot com Baileys

## O que é Baileys?

Baileys é uma biblioteca Node.js que permite criar bots do WhatsApp sem precisar manter o WhatsApp Web aberto. É uma solução mais robusta e confiável que outras alternativas.

## Vantagens

✅ **Não precisa manter WhatsApp Web aberto**  
✅ **Envio instantâneo de mensagens**  
✅ **Mais confiável e estável**  
✅ **Funciona em servidor/serviço de fundo**  
✅ **Suporta múltiplas conexões**

## Instalação

### 1. Instalar Node.js

Certifique-se de ter Node.js instalado (versão 16 ou superior):

```bash
node --version
npm --version
```

Se não tiver, baixe em: https://nodejs.org/

### 2. Instalar dependências do bot WhatsApp

```bash
npm install
```

Isso instalará:
- `@whiskeysockets/baileys` - Biblioteca principal do Baileys
- `express` - Servidor HTTP para API
- `qrcode-terminal` - Exibe QR Code no terminal
- `pino` - Logger

### 3. Instalar dependências do Python (Flask)

```bash
pip install requests
```

Ou instale todas as dependências:

```bash
pip install -r requirements.txt
```

## Como Usar

### 1. Iniciar o Bot WhatsApp

Em um terminal, execute:

```bash
npm start
```

Ou para desenvolvimento com auto-reload:

```bash
npm run dev
```

### 2. Conectar ao WhatsApp

Na primeira execução, você verá um QR Code no terminal:

```
📱 Escaneie o QR Code abaixo com seu WhatsApp:
[QR CODE AQUI]
⏳ Aguardando conexão...
```

1. Abra o WhatsApp no seu celular
2. Vá em **Configurações > Aparelhos conectados > Conectar um aparelho**
3. Escaneie o QR Code exibido no terminal
4. Aguarde a mensagem: `✅ Conectado ao WhatsApp com sucesso!`

### 3. Manter o Bot Rodando

**IMPORTANTE:** O bot precisa estar rodando para enviar mensagens. Você pode:

- Deixar o terminal aberto
- Usar `pm2` ou `forever` para rodar em background
- Criar um serviço systemd (Linux)

### 4. Iniciar o Servidor Flask

Em outro terminal, execute:

```bash
python3 app.py
```

## Configuração

### Telefone da Raissa

No arquivo `app.py`, configure o telefone:

```python
WHATSAPP_RAISSA = '5511993940514'  # Formato: código país + DDD + número
```

### URL do Bot (se necessário)

Se o bot estiver rodando em outra máquina/porta:

```python
WHATSAPP_BOT_URL = 'http://localhost:3001'  # Padrão
```

Ou defina variável de ambiente:

```bash
export WHATSAPP_BOT_URL=http://localhost:3001
```

### Porta do Bot

Por padrão, o bot roda na porta 3001. Para mudar:

```bash
export WHATSAPP_PORT=3001
npm start
```

## Como Funciona

1. **Cliente cria agendamento** → Flask recebe requisição
2. **Flask chama API do Bot** → Envia dados para `  `
3. **Bot envia mensagem** → Baileys envia via WhatsApp automaticamente
4. **Raissa recebe notificação** → Mensagem chega instantaneamente no WhatsApp

## Estrutura de Arquivos

```
.
├── whatsapp-bot.js          # Serviço Node.js com Baileys
├── package.json             # Dependências Node.js
├── whatsapp_auth/          # Autenticação (criado automaticamente)
│   ├── creds.json
│   └── ...
├── app.py                   # Servidor Flask
└── CONFIGURACAO_BAILEYS.md  # Este arquivo
```

## Autenticação

A primeira vez que você rodar o bot, ele criará a pasta `whatsapp_auth/` com os dados de autenticação. **Não compartilhe esta pasta** - ela contém suas credenciais do WhatsApp.

Se precisar reconectar:
1. Pare o bot
2. Remova a pasta `whatsapp_auth/`
3. Inicie o bot novamente
4. Escaneie o novo QR Code

## Rodar em Background (Produção)

### Usando PM2 (Recomendado)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar bot
pm2 start whatsapp-bot.js --name whatsapp-bot

# Ver logs
pm2 logs whatsapp-bot

# Reiniciar
pm2 restart whatsapp-bot

# Parar
pm2 stop whatsapp-bot
```

### Usando Forever

```bash
# Instalar forever globalmente
npm install -g forever

# Iniciar bot
forever start whatsapp-bot.js

# Ver logs
forever logs whatsapp-bot.js

# Parar
forever stop whatsapp-bot.js
```

## Troubleshooting

### Bot não conecta

- Verifique se o Node.js está instalado: `node --version`
- Remova a pasta `whatsapp_auth/` e escaneie o QR Code novamente
- Verifique se não há outro processo usando a porta 3001

### Mensagens não são enviadas

- Verifique se o bot está rodando: `curl http://localhost:3001/status`
- Verifique os logs do bot para erros
- Certifique-se de que o Flask está chamando a URL correta

### Erro de conexão

- Verifique se o bot está rodando antes de iniciar o Flask
- Verifique se a porta 3001 está acessível
- Verifique firewall/antivírus

## API Endpoints

### POST `/send-message`

Envia uma mensagem via WhatsApp.

**Request:**
```json
{
  "phoneNumber": "5511993940514",
  "message": "Sua mensagem aqui"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mensagem enviada com sucesso"
}
```

### GET `/status`

Verifica se o bot está conectado.

**Response:**
```json
{
  "connected": true,
  "message": "WhatsApp conectado e pronto"
}
```

## Segurança

⚠️ **Importante:**
- Não compartilhe a pasta `whatsapp_auth/`
- Não exponha a porta 3001 publicamente sem autenticação
- Use HTTPS em produção
- Considere adicionar autenticação à API

## Próximos Passos

- Adicionar autenticação à API
- Implementar retry automático
- Adicionar logs mais detalhados
- Criar dashboard de monitoramento
