const axios = require('axios');

const EVOLUTION_API_URL = 'https://evolution-api-production-b8e8.up.railway.app';
const EVOLUTION_API_KEY = 'B6D711FCDE4D4FD5936544120E713976';
const INSTANCE_NAME = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
const WEBHOOK_URL = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';

async function testWebhookConfiguration() {
  console.log('🔍 Testando configuração do webhook...\n');

  try {
    // 1. Verificar configuração atual do webhook
    console.log('1. Verificando configuração atual do webhook...');
    const webhookResponse = await axios.get(
      `${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Configuração atual do webhook:');
    console.log(JSON.stringify(webhookResponse.data, null, 2));
    console.log('\n');

    // 2. Configurar webhook com URL correta (sem sub-rotas)
    console.log('2. Configurando webhook com URL principal...');
    const webhookConfig = {
      url: WEBHOOK_URL, // URL principal sem sub-rotas
      enabled: true,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      webhookByEvents: false // Desabilitar sub-rotas
    };

    const setWebhookResponse = await axios.post(
      `${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`,
      webhookConfig,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Webhook configurado:');
    console.log(JSON.stringify(setWebhookResponse.data, null, 2));
    console.log('\n');

    // 3. Verificar configuração após mudança
    console.log('3. Verificando configuração após mudança...');
    const updatedWebhookResponse = await axios.get(
      `${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Nova configuração do webhook:');
    console.log(JSON.stringify(updatedWebhookResponse.data, null, 2));
    console.log('\n');

    // 4. Testar envio de mensagem
    console.log('4. Testando envio de mensagem...');
    const messagePayload = {
      number: '5511999999999', // Número de teste
      text: 'Teste de webhook - ' + new Date().toISOString()
    };

    const sendMessageResponse = await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`,
      messagePayload,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Mensagem enviada:');
    console.log(JSON.stringify(sendMessageResponse.data, null, 2));

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testWebhookConfiguration();