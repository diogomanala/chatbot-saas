const axios = require('axios');

// Dados obtidos diretamente do Supabase
const EVOLUTION_BASE_URL = 'https://evolution-api-evolution-api.audihb.easypanel.host';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_ID = '309f5bd6-4d5f-4053-95e1-d39807d2e59e'; // ID real da instância (não o nome)
const WEBHOOK_URL = 'https://saas-chatbot-production.vercel.app/api/webhook';

async function configureWebhook() {
    try {
        console.log('🔧 Configurando webhook com dados do Supabase...');
        console.log(`Instance ID: ${INSTANCE_ID}`);
        console.log(`Webhook URL: ${WEBHOOK_URL}`);
        
        // 1. Verificar se a instância existe
        console.log('\n📋 Verificando instância...');
        const instanceResponse = await axios.get(
            `${EVOLUTION_BASE_URL}/instance/fetchInstances`,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Instâncias disponíveis:');
        instanceResponse.data.forEach(inst => {
            console.log(`- Nome: ${inst.name || inst.instanceName || 'N/A'}`);
            console.log(`  ID: ${inst.id || inst.instanceId || 'N/A'}`);
            console.log(`  Status: ${inst.connectionStatus || inst.status || 'N/A'}`);
            console.log('---');
        });
        
        // 2. Configurar webhook
        console.log('\n🔗 Configurando webhook...');
        const webhookConfig = {
            webhook: {
                url: WEBHOOK_URL,
                webhook_by_events: false,
                webhook_base64: false,
                events: [
                    'MESSAGES_UPSERT',
                    'CONNECTION_UPDATE'
                ]
            }
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
        
        // 3. Verificar configuração do webhook
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
        
        // 4. Verificar status da conexão
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
        
        console.log('\n🎉 Configuração concluída com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao configurar webhook:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

configureWebhook();