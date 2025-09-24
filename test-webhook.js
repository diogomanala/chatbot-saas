const axios = require('axios');

// Configurações do teste
const WEBHOOK_URL = 'http://localhost:3000/api/webhook/evolution';
const EVOLUTION_API_URL = 'http://localhost:8080';
const INSTANCE_NAME = 'saas-chatbot';

console.log('🔍 Testando webhook e Evolution API...\n');

// 1. Testar se o webhook está respondendo
async function testWebhook() {
  console.log('1. Testando webhook endpoint...');
  
  try {
    const testPayload = {
      event: 'messages.upsert',
      instance: INSTANCE_NAME,
      data: {
        key: {
          remoteJid: '5521967725481@s.whatsapp.net',
          fromMe: false,
          id: 'test-message-id'
        },
        message: {
          conversation: 'Teste de webhook'
        },
        messageTimestamp: Date.now(),
        pushName: 'Teste'
      }
    };

    const response = await axios.post(WEBHOOK_URL, testPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Webhook respondeu:', response.status);
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Erro no webhook:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// 2. Testar conexão com Evolution API
async function testEvolutionAPI() {
  console.log('\n2. Testando Evolution API...');
  
  try {
    // Testar status da instância
    const statusResponse = await axios.get(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
      headers: {
        'apikey': process.env.EVOLUTION_API_KEY || 'B6D711FCDE4D4FD5936544120E713976'
      },
      timeout: 5000
    });

    console.log('✅ Evolution API status:', statusResponse.status);
    console.log('Instance state:', statusResponse.data);
  } catch (error) {
    console.error('❌ Erro na Evolution API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// 3. Testar envio de mensagem
async function testSendMessage() {
  console.log('\n3. Testando envio de mensagem...');
  
  try {
    const messagePayload = {
      number: '5521967725481',
      text: 'Teste de mensagem do chatbot restaurado'
    };

    const response = await axios.post(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, messagePayload, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.EVOLUTION_API_KEY || 'B6D711FCDE4D4FD5936544120E713976'
      },
      timeout: 10000
    });

    console.log('✅ Mensagem enviada:', response.status);
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Executar todos os testes
async function runAllTests() {
  await testWebhook();
  await testEvolutionAPI();
  await testSendMessage();
  
  console.log('\n✅ Testes concluídos!');
}

runAllTests().catch(console.error);