const axios = require('axios');

// Dados corretos da instância que está funcionando
const EVOLUTION_BASE_URL = 'https://evolution-api-evolution-api.audihb.easypanel.host';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_ID = '309f5bd6-4d5f-4053-95e1-d39807d2e59e'; // ID da instância que está "open"
const WEBHOOK_URL = 'https://saas-chatbot-production.vercel.app/api/webhook';

async function configureAndTest() {
    try {
        console.log('🔧 Configurando webhook na instância funcional...');
        console.log(`Instance ID: ${INSTANCE_ID}`);
        console.log(`Webhook URL: ${WEBHOOK_URL}`);
        
        // 1. Configurar webhook usando endpoint correto
        console.log('\n🔗 Configurando webhook...');
        const webhookConfig = {
            url: WEBHOOK_URL,
            webhook_by_events: false,
            webhook_base64: false,
            events: [
                'MESSAGES_UPSERT',
                'CONNECTION_UPDATE'
            ]
        };
        
        const webhookResponse = await axios.post(
            `${EVOLUTION_BASE_URL}/webhook/set/${INSTANCE_ID}`,
            webhookConfig,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Webhook configurado com sucesso!');
        console.log('Resposta:', JSON.stringify(webhookResponse.data, null, 2));
        
        // 2. Verificar configuração do webhook
        console.log('\n🔍 Verificando configuração do webhook...');
        const webhookCheckResponse = await axios.get(
            `${EVOLUTION_BASE_URL}/webhook/find/${INSTANCE_ID}`,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Configuração atual do webhook:');
        console.log(JSON.stringify(webhookCheckResponse.data, null, 2));
        
        // 3. Verificar status da conexão
        console.log('\n📱 Verificando status da conexão...');
        const connectionResponse = await axios.get(
            `${EVOLUTION_BASE_URL}/instance/connectionState/${INSTANCE_ID}`,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Status da conexão:');
        console.log(JSON.stringify(connectionResponse.data, null, 2));
        
        // 4. Tentar enviar mensagem de teste (se conectado)
        if (connectionResponse.data.state === 'open') {
            console.log('\n📤 Enviando mensagem de teste...');
            
            // Usar número de teste (substitua pelo seu número)
            const testNumber = '5522997603813'; // Número do dispositivo
            
            const messageData = {
                number: testNumber,
                text: '🤖 Teste de webhook configurado via Supabase! Se você receber esta mensagem, tudo está funcionando corretamente.'
            };
            
            const messageResponse = await axios.post(
                `${EVOLUTION_BASE_URL}/message/sendText/${INSTANCE_ID}`,
                messageData,
                {
                    headers: {
                        'apikey': EVOLUTION_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ Mensagem de teste enviada!');
            console.log('Resposta:', JSON.stringify(messageResponse.data, null, 2));
        } else {
            console.log('⚠️ Instância não está conectada. Status:', connectionResponse.data.state);
        }
        
        console.log('\n🎉 Configuração e teste concluídos!');
        console.log('📝 Próximos passos:');
        console.log('1. Verifique se o webhook está recebendo eventos no Vercel');
        console.log('2. Teste enviando mensagens para o WhatsApp');
        console.log('3. Monitore os logs da aplicação');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

configureAndTest();