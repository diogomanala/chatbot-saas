const axios = require('axios');

const EVOLUTION_API_URL = 'https://evolution-api-evolution-api.audihb.easypanel.host';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';

async function testWhatsAppMessages() {
  console.log('📱 Testando recepção de mensagens do WhatsApp...\n');

  try {
    // 1. Verificar status da instância
    console.log('1. Verificando status da instância...');
    const instancesResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/fetchInstances`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const targetInstance = instancesResponse.data.find(
      instance => instance.name === INSTANCE_NAME
    );

    if (!targetInstance) {
      console.log('❌ Instância não encontrada');
      return;
    }

    console.log(`✅ Instância encontrada: ${targetInstance.name}`);
    console.log(`   Status: ${targetInstance.connectionStatus}`);
    
    if (targetInstance.connectionStatus !== 'open') {
      console.log('⚠️ Instância não está conectada. Status:', targetInstance.connectionStatus);
      return;
    }

    // 2. Verificar configuração do webhook
    console.log('\n2. Verificando configuração do webhook...');
    const webhookResponse = await axios.get(
      `${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Configuração do webhook:');
    console.log(`   URL: ${webhookResponse.data.url}`);
    console.log(`   Enabled: ${webhookResponse.data.enabled}`);
    console.log(`   Events: ${webhookResponse.data.events.join(', ')}`);
    console.log(`   WebhookByEvents: ${webhookResponse.data.webhookByEvents}`);
    
    if (webhookResponse.data.webhookByEvents === false) {
      console.log('✅ Webhook configurado corretamente (webhookByEvents: false)');
    } else {
      console.log('⚠️ Webhook ainda com webhookByEvents: true');
    }

    // 3. Enviar mensagem de teste
    console.log('\n3. Enviando mensagem de teste...');
    const testMessage = `🧪 Teste de webhook - ${new Date().toLocaleString('pt-BR')}`;
    
    // Use seu próprio número para teste
    const testNumber = '5511999999999'; // Substitua pelo seu número
    
    const messagePayload = {
      number: testNumber,
      text: testMessage
    };

    const sendResponse = await axios.post(
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
    console.log(`   Para: ${testNumber}`);
    console.log(`   Texto: ${testMessage}`);
    console.log(`   ID: ${sendResponse.data.key?.id || 'N/A'}`);
    
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Envie uma mensagem de volta pelo WhatsApp');
    console.log('2. Verifique os logs do servidor (npm run dev)');
    console.log('3. Confirme se o webhook está recebendo as mensagens');
    console.log('4. Teste se o chatbot está respondendo corretamente');

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testWhatsAppMessages();