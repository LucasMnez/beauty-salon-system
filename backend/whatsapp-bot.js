/**
 * Serviço WhatsApp Bot usando Baileys
 * Envia mensagens automáticas quando agendamentos são criados
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.WHATSAPP_PORT || 3001;
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '5511993940514';

// Diretório para armazenar autenticação
const authFolder = path.join(__dirname, 'whatsapp_auth');

let socket = null;
let isConnected = false;
let currentQR = null; // Armazenar QR Code atual

// Criar diretório de autenticação se não existir
if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
}

/**
 * Conecta ao WhatsApp usando Baileys
 */
async function connectToWhatsApp() {
    try {
        console.log('🔄 Iniciando conexão com WhatsApp...');
        
        // Verificar se pasta de autenticação existe
        if (!fs.existsSync(authFolder)) {
            console.log('📁 Criando pasta de autenticação...');
            fs.mkdirSync(authFolder, { recursive: true });
        }
        
        console.log('📦 Carregando estado de autenticação...');
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        console.log('✅ Estado de autenticação carregado');
        
        // Verificar se tem credenciais salvas
        const authFiles = fs.readdirSync(authFolder);
        if (authFiles.length === 0) {
            console.log('📱 Nenhuma autenticação encontrada. Gerando novo QR Code...');
        } else {
            console.log(`📱 Tentando usar autenticação existente (${authFiles.length} arquivos)...`);
        }
        
        console.log('🔌 Criando socket WhatsApp...');
        socket = makeWASocket({
            auth: state,
            logger: pino({ level: 'info' }), // Mudar para 'info' para ver mais logs
            browser: ['Raissa Nails', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            retryRequestDelayMs: 250,
            markOnlineOnConnect: false,
            syncFullHistory: false,
            printQRInTerminal: false // Desabilitar QR no terminal (vamos usar web)
        });
        console.log('✅ Socket criado');

        socket.ev.on('creds.update', saveCreds);
        console.log('✅ Event listeners configurados');

        socket.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr, isNewLogin } = update;

            console.log(`📡 Evento connection.update: connection=${connection}, hasQR=${!!qr}, isNewLogin=${isNewLogin}`);

            if (qr) {
                currentQR = qr; // Armazenar QR Code
                console.log('\n✅✅✅ QR CODE GERADO! ✅✅✅');
                console.log('📱 Acesse: http://localhost:3001/qrcode');
                console.log('📱 Ou escaneie o QR Code abaixo no terminal:');
                qrcode.generate(qr, { small: true });
                console.log('\n⏳ Aguardando conexão...\n');
                console.log('💡 Dica: Abra o WhatsApp > Configurações > Aparelhos conectados > Conectar um aparelho\n');
            }

            if (connection === 'close') {
                const error = lastDisconnect?.error;
                const statusCode = error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log('❌ Conexão fechada');
                if (error) {
                    console.log(`   Erro: ${error.message || 'Desconhecido'}`);
                    console.log(`   Status: ${statusCode || 'N/A'}`);
                    console.log(`   Reason: ${error?.data?.reason || 'N/A'}`);
                }
                
                if (statusCode === DisconnectReason.loggedOut) {
                    currentQR = null; // Limpar QR Code
                    console.log('\n⚠️  Você foi desconectado do WhatsApp.');
                    console.log('💡 Removendo autenticação antiga...');
                    // Remover autenticação automaticamente
                    setTimeout(() => {
                        fs.rmSync(authFolder, { recursive: true, force: true });
                        fs.mkdirSync(authFolder, { recursive: true });
                        console.log('✅ Autenticação removida. Reiniciando em 3 segundos...');
                        setTimeout(() => {
                            connectToWhatsApp();
                        }, 3000);
                    }, 1000);
                    isConnected = false;
                } else if (statusCode === DisconnectReason.connectionClosed || statusCode === DisconnectReason.connectionLost) {
                    console.log('🔄 Reconectando em 10 segundos...');
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, 10000);
                } else if (statusCode === 405) {
                    // Erro 405 - WhatsApp bloqueando conexão (muitas tentativas ou IP bloqueado)
                    console.log('\n⚠️⚠️⚠️  ERRO 405: WhatsApp está BLOQUEANDO a conexão ⚠️⚠️⚠️');
                    console.log('💡 Possíveis causas:');
                    console.log('   - Muitas tentativas de conexão em pouco tempo');
                    console.log('   - IP temporariamente bloqueado pelo WhatsApp');
                    console.log('   - Aguarde pelo menos 1-2 HORAS antes de tentar novamente');
                    console.log('');
                    console.log('🛑 PARANDO tentativas automáticas para evitar bloqueio permanente.');
                    console.log('💡 Para tentar novamente:');
                    console.log('   1. Aguarde 1-2 horas');
                    console.log('   2. Execute: pm2 restart whatsapp-bot');
                    console.log('   3. Ou use VPN/proxy diferente');
                    console.log('');
                    // NÃO tentar reconectar automaticamente - aguardar intervenção manual
                    isConnected = false;
                    // Não remover autenticação nem tentar reconectar
                } else if (shouldReconnect) {
                    console.log('🔄 Tentando reconectar em 10 segundos...');
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, 10000);
                } else {
                    console.log('⚠️  Erro de conexão. Verifique sua internet e tente novamente.');
                    console.log('💡 Aguardando 15 segundos antes de tentar novamente...');
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, 15000);
                }
                
                isConnected = false;
            } else if (connection === 'open') {
                currentQR = null; // Limpar QR Code após conectar
                console.log('✅ Conectado ao WhatsApp com sucesso!');
                console.log('📱 Bot pronto para enviar mensagens\n');
                isConnected = true;
            } else if (connection === 'connecting') {
                console.log('🔄 Conectando ao WhatsApp...');
            }
        });

        socket.ev.on('messages.upsert', async (m) => {
            // Opcional: processar mensagens recebidas
        });
    } catch (error) {
        console.error('❌ Erro ao conectar:', error);
        console.log('💡 Tentando novamente em 10 segundos...');
        setTimeout(() => {
            connectToWhatsApp();
        }, 10000);
    }
}

/**
 * Envia mensagem via WhatsApp
 */
async function sendWhatsAppMessage(phoneNumber, message) {
    if (!isConnected || !socket) {
        throw new Error('WhatsApp não está conectado. Aguarde a conexão.');
    }

    try {
        // Formatar número (remover caracteres não numéricos e adicionar @s.whatsapp.net)
        const formattedNumber = phoneNumber.replace(/\D/g, '') + '@s.whatsapp.net';
        
        console.log(`📤 Enviando mensagem para ${formattedNumber}...`);
        
        const result = await socket.sendMessage(formattedNumber, {
            text: message
        });

        console.log(`✅ Mensagem enviada com sucesso para ${phoneNumber}`);
        console.log(`   ID da mensagem: ${result.key.id}`);
        return { 
            success: true, 
            message: 'Mensagem enviada com sucesso',
            messageId: result.key.id,
            phoneNumber: phoneNumber
        };
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        console.error('   Detalhes:', error.message);
        throw error;
    }
}

/**
 * API Endpoint para mostrar QR Code no navegador
 */
app.get('/qrcode', async (req, res) => {
    if (!currentQR) {
        if (isConnected) {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WhatsApp Bot - Conectado</title>
                    <meta charset="utf-8">
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                            color: white;
                        }
                        .container {
                            text-align: center;
                            padding: 40px;
                            background: rgba(255,255,255,0.1);
                            border-radius: 20px;
                            backdrop-filter: blur(10px);
                        }
                        .status {
                            font-size: 48px;
                            margin-bottom: 20px;
                        }
                        h1 { margin: 0; }
                        p { font-size: 18px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="status">✅</div>
                        <h1>WhatsApp Conectado!</h1>
                        <p>O bot está conectado e pronto para enviar mensagens.</p>
                        <p><a href="/status" style="color: white;">Ver Status</a></p>
                    </div>
                </body>
                </html>
            `);
        } else {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WhatsApp Bot - Aguardando QR Code</title>
                    <meta charset="utf-8">
                    <meta http-equiv="refresh" content="3">
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                            color: white;
                        }
                        .container {
                            text-align: center;
                            padding: 40px;
                            background: rgba(255,255,255,0.1);
                            border-radius: 20px;
                            backdrop-filter: blur(10px);
                        }
                        .spinner {
                            border: 4px solid rgba(255,255,255,0.3);
                            border-top: 4px solid white;
                            border-radius: 50%;
                            width: 50px;
                            height: 50px;
                            animation: spin 1s linear infinite;
                            margin: 20px auto;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        h1 { margin: 0; }
                        p { font-size: 18px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="spinner"></div>
                        <h1>Aguardando QR Code...</h1>
                        <p>O bot está iniciando. Esta página será atualizada automaticamente.</p>
                    </div>
                </body>
                </html>
            `);
        }
    }

    try {
        // Gerar QR Code como imagem PNG
        const qrImage = await QRCode.toDataURL(currentQR, {
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Bot - QR Code</title>
                <meta charset="utf-8">
                <meta http-equiv="refresh" content="30">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                        color: white;
                    }
                    .container {
                        text-align: center;
                        padding: 40px;
                        background: rgba(255,255,255,0.1);
                        border-radius: 20px;
                        backdrop-filter: blur(10px);
                        max-width: 500px;
                    }
                    .qrcode {
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        display: inline-block;
                        margin: 20px 0;
                    }
                    .qrcode img {
                        display: block;
                    }
                    h1 { margin: 0 0 20px 0; }
                    .instructions {
                        background: rgba(255,255,255,0.2);
                        padding: 20px;
                        border-radius: 10px;
                        margin-top: 20px;
                        text-align: left;
                    }
                    .instructions ol {
                        margin: 10px 0;
                        padding-left: 20px;
                    }
                    .instructions li {
                        margin: 10px 0;
                    }
                    .status {
                        margin-top: 20px;
                        font-size: 14px;
                        opacity: 0.8;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 Conectar WhatsApp</h1>
                    <div class="qrcode">
                        <img src="${qrImage}" alt="QR Code WhatsApp">
                    </div>
                    <div class="instructions">
                        <strong>Como conectar:</strong>
                        <ol>
                            <li>Abra o WhatsApp no seu celular</li>
                            <li>Vá em: <strong>Configurações</strong> → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong></li>
                            <li>Escaneie o QR Code acima</li>
                            <li>Aguarde a confirmação de conexão</li>
                        </ol>
                    </div>
                    <div class="status">
                        ⏳ Esta página será atualizada automaticamente quando conectar<br>
                        🔄 Ou acesse: <a href="/status" style="color: white;">Ver Status</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Erro ao gerar QR Code:', error);
        res.status(500).send('Erro ao gerar QR Code');
    }
});

/**
 * API Endpoint para enviar mensagem
 */
app.post('/send-message', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        if (!phoneNumber || !message) {
            return res.status(400).json({ 
                error: 'phoneNumber e message são obrigatórios' 
            });
        }

        if (!isConnected) {
            return res.status(503).json({ 
                error: 'WhatsApp não está conectado. Aguarde a conexão.' 
            });
        }

        const result = await sendWhatsAppMessage(phoneNumber, message);
        res.json(result);
    } catch (error) {
        console.error('Erro no endpoint /send-message:', error);
        res.status(500).json({ 
            error: 'Erro ao enviar mensagem', 
            details: error.message 
        });
    }
});

/**
 * API Endpoint para verificar status da conexão
 */
app.get('/status', (req, res) => {
    res.json({
        connected: isConnected,
        hasQR: currentQR !== null,
        message: isConnected ? 'WhatsApp conectado e pronto' : (currentQR ? 'QR Code disponível. Escaneie para conectar.' : 'WhatsApp não conectado')
    });
});

/**
 * Iniciar servidor
 */
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor WhatsApp Bot rodando na porta ${PORT}`);
    console.log(`📱 Endpoint: http://localhost:${PORT}/send-message`);
    console.log(`📊 Status: http://localhost:${PORT}/status`);
    console.log(`📱 QR Code: http://localhost:${PORT}/qrcode\n`);
    
    // Conectar ao WhatsApp
    connectToWhatsApp();
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
    console.error('Erro não tratado:', error);
});
