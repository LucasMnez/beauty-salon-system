#!/usr/bin/env node
/**
 * Script para testar o envio de mensagem WhatsApp
 */

const http = require('http');

const WHATSAPP_BOT_URL = process.env.WHATSAPP_BOT_URL || 'http://localhost:3001';
const TELEFONE_TESTE = process.env.WHATSAPP_RAISSA || '5511993940514';

// Testar status primeiro
console.log('🔍 Verificando status do bot WhatsApp...\n');

const statusReq = http.get(`${WHATSAPP_BOT_URL}/status`, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const status = JSON.parse(data);
            console.log('📊 Status:', status);
            
            if (!status.connected) {
                console.log('\n❌ WhatsApp não está conectado!');
                console.log('💡 Execute: pm2 logs whatsapp-bot');
                console.log('💡 Ou escaneie o QR Code novamente');
                process.exit(1);
            }
            
            console.log('\n✅ WhatsApp está conectado!');
            console.log('\n📤 Enviando mensagem de teste...\n');
            
            // Enviar mensagem de teste
            const mensagemTeste = `🧪 *TESTE DE ENVIO AUTOMÁTICO*

Esta é uma mensagem de teste do sistema de agendamento.

Se você recebeu esta mensagem, o sistema está funcionando corretamente! ✅

Data/Hora: ${new Date().toLocaleString('pt-BR')}`;
            
            const postData = JSON.stringify({
                phoneNumber: TELEFONE_TESTE,
                message: mensagemTeste
            });
            
            const options = {
                hostname: 'localhost',
                port: 3001,
                path: '/send-message',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };
            
            const sendReq = http.request(options, (sendRes) => {
                let responseData = '';
                
                sendRes.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                sendRes.on('end', () => {
                    if (sendRes.statusCode === 200) {
                        const result = JSON.parse(responseData);
                        console.log('✅ Mensagem enviada com sucesso!');
                        console.log('📋 Detalhes:');
                        console.log(`   ID: ${result.messageId || 'N/A'}`);
                        console.log(`   Telefone: ${result.phoneNumber}`);
                        console.log('\n✅ Teste concluído com sucesso!');
                    } else {
                        console.log(`❌ Erro ao enviar: ${sendRes.statusCode}`);
                        console.log('Resposta:', responseData);
                    }
                });
            });
            
            sendReq.on('error', (error) => {
                console.error('❌ Erro na requisição:', error.message);
            });
            
            sendReq.write(postData);
            sendReq.end();
            
        } catch (error) {
            console.error('❌ Erro ao processar resposta:', error);
        }
    });
});

statusReq.on('error', (error) => {
    console.error('❌ Erro ao conectar com o bot:', error.message);
    console.log('\n💡 Certifique-se de que o bot está rodando:');
    console.log('   pm2 start whatsapp-bot.js --name whatsapp-bot');
    process.exit(1);
});
