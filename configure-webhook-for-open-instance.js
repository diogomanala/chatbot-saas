require('dotenv').config();
const axios = require('axios');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

console.log('🔧 CONFIGURANDO WEBHOOK PARA INSTÂNCIA OPEN...\n');

async function configureWebhookForOpenInstance() {
    try {
        console.log('📋 Configurações:');
        console.log(`URL: ${EVOLUTION_URL}`);
        console.log(`Instance ID: ${EVOLUTION_INSTANCE}`);
        console.log(`Webhook URL: ${WEBHOOK_URL}`);
        console.log(`Key: ${EVOLUTION_KEY ? '***configurada***' : 'NÃO CONFIGURADA'}\n`);

        // 1. Verificar se a instância existe e está open
        console.log('1️⃣ Verificando status da instância...');
        const instancesResponse = await axios.get(
            `${EVOLUTION_URL}/instance/fetchInstances`,
            {
                headers: {
                    'apikey': EVOLUTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const ourInstance = instancesResponse.data.find(inst => inst.id === EVOLUTION_INSTANCE);
        
        if (!ourInstance) {
            console.log('❌ Instância não encontrada!');
            return;
        }

        console.log(`📱 Status: ${ourInstance.connectionStatus}`);
        console.log(`👤 Proprietário: ${ourInstance.ownerJid}`);
        console.log(`📞 Número: ${ourInstance.number || 'Não definido'}`);

        if (ourInstance.connectionStatus !== 'open') {
            console.log('❌ Instância não está conectada (open). Status atual:', ourInstance.connectionStatus);
            return;
        }

        // 2. Configurar webhook
        console.log('\n2️⃣ Configurando webhook...');
        const webhookConfig = {
            url: WEBHOOK_URL,
            enabled: true,
            events: [
                'MESSAGES_UPSERT',
                'CONNECTION_UPDATE'
            ]
        };

        const webhookResponse = await axios.post(
            `${EVOLUTION_URL}/webhook/set/${EVOLUTION_INSTANCE}`,
            webhookConfig,
            {
                headers: {
                    'apikey': EVOLUTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Webhook configurado com sucesso!');
        console.log('📊 Resposta:', JSON.stringify(webhookResponse.data, null, 2));

        // 3. Verificar configuração
        console.log('\n3️⃣ Verificando configuração do webhook...');
        const checkResponse = await axios.get(
            `${EVOLUTION_URL}/webhook/find/${EVOLUTION_INSTANCE}`,
            {
                headers: {
                    'apikey': EVOLUTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('📋 Configuração atual do webhook:');
        console.log(JSON.stringify(checkResponse.data, null, 2));

        // 4. Testar envio de mensagem de teste
        console.log('\n4️⃣ Testando envio de mensagem...');
        const testMessage = {
            number: ourInstance.ownerJid.replace('@s.whatsapp.net', ''),
            text: `🤖 Teste de webhook - ${new Date().toLocaleString()}\n\nSe você recebeu esta mensagem, o webhook está funcionando!`
        };

        try {
            const sendResponse = await axios.post(
                `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
                testMessage,
                {
                    headers: {
                        'apikey': EVOLUTION_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('📤 Mensagem de teste enviada!');
            console.log('📊 Resposta:', JSON.stringify(sendResponse.data, null, 2));
            
            console.log('\n🎉 CONFIGURAÇÃO COMPLETA!');
            console.log('📱 Verifique se recebeu a mensagem de teste no WhatsApp');
            console.log('🔍 Monitore os logs do seu servidor para ver se o webhook está recebendo eventos');
            
        } catch (sendError) {
            console.log('❌ Erro ao enviar mensagem de teste:', sendError.response?.data || sendError.message);
        }

    } catch (error) {
        console.error('❌ Erro geral:', error.response?.data || error.message);
    }
}

configureWebhookForOpenInstance();