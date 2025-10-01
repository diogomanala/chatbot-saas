const axios = require('axios');

const EVOLUTION_BASE_URL = 'https://evolution-api-evolution-api.audihb.easypanel.host';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
const WEBHOOK_URL = 'https://saas-chatbot-production.vercel.app/api/webhook';

async function configureAndTestWebhook() {
    try {
        console.log('🔧 Configurando webhook na instância correta...');
        console.log('Instance Name:', INSTANCE_NAME);
        console.log('Webhook URL:', WEBHOOK_URL);
        
        // 1. Verificar se a instância existe e está conectada
        console.log('\n1️⃣ Verificando status da instância...');
        const connectionResponse = await axios.get(
            `${EVOLUTION_BASE_URL}/instance/connectionState/${INSTANCE_NAME}`,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Status da instância:', connectionResponse.data);
        
        if (connectionResponse.data.instance.state !== 'open') {
            console.log('⚠️ Instância não está conectada. Status:', connectionResponse.data.instance.state);
            return;
        }
        
        // 2. Configurar webhook
        console.log('\n2️⃣ Configurando webhook...');
        const webhookConfig = {
            webhook: {
                url: WEBHOOK_URL,
                events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
                enabled: true,
                webhookByEvents: false,
                webhookBase64: false
            }
        };
        
        const webhookResponse = await axios.post(
            `${EVOLUTION_BASE_URL}/webhook/set/${INSTANCE_NAME}`,
            webhookConfig,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Webhook configurado:', webhookResponse.data);
        
        // 3. Verificar configuração do webhook
        console.log('\n3️⃣ Verificando configuração do webhook...');
        const webhookCheckResponse = await axios.get(
            `${EVOLUTION_BASE_URL}/webhook/find/${INSTANCE_NAME}`,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Webhook configurado corretamente:', webhookCheckResponse.data);
        
        // 4. Testar envio de mensagem
        console.log('\n4️⃣ Testando envio de mensagem...');
        const messageData = {
            number: '5521967725481', // Número de teste
            text: '🤖 Teste de webhook configurado com sucesso! O chatbot está funcionando.'
        };
        
        const messageResponse = await axios.post(
            `${EVOLUTION_BASE_URL}/message/sendText/${INSTANCE_NAME}`,
            messageData,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Mensagem enviada:', messageResponse.data);
        
        console.log('\n🎉 Configuração concluída com sucesso!');
        console.log('📱 Instância:', INSTANCE_NAME);
        console.log('🔗 Webhook:', WEBHOOK_URL);
        console.log('✅ Status: Conectado e funcionando');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

configureAndTestWebhook();