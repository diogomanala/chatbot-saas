const axios = require('axios');

const PRODUCTION_WEBHOOK_URL = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';

// Simular uma mensagem real que seria enviada pela Evolution API
const testMessage = {
  event: 'messages.upsert',
  instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
  data: {
    key: {
      remoteJid: '5522997603813@s.whatsapp.net',
      fromMe: false,
      id: 'TEST_MESSAGE_ID_' + Date.now()
    },
    pushName: 'Diogo Barreto',
    message: {
      conversation: 'Teste de webhook em produção'
    },
    messageType: 'conversation',
    messageTimestamp: Math.floor(Date.now() / 1000),
    instanceId: '309f5bd6-4d5f-4053-95e1-d39807d2e59e',
    source: 'android'
  },
  destination: 'webhook',
  date_time: new Date().toISOString(),
  sender: 'evolution_api',
  server_url: 'https://evolution-api-evolution-api.audihb.easypanel.host',
  apikey: '429683C4C977415CAAFCCE10F7D57E11'
};

async function testProductionWebhook() {
  console.log('🧪 Testando webhook diretamente no ambiente de produção...\n');
  
  try {
    console.log('📤 Enviando mensagem de teste para:', PRODUCTION_WEBHOOK_URL);
    console.log('📋 Payload:', JSON.stringify(testMessage, null, 2));
    console.log('\n⏳ Aguardando resposta...\n');
    
    const response = await axios.post(PRODUCTION_WEBHOOK_URL, testMessage, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Evolution-API-Webhook'
      },
      timeout: 30000 // 30 segundos
    });
    
    console.log('✅ Webhook respondeu com sucesso!');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Resposta:', response.data);
    
  } catch (error) {
    console.error('❌ Erro ao testar webhook:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Dados:', error.response.data);
    } else if (error.request) {
      console.error('Nenhuma resposta recebida:', error.message);
    } else {
      console.error('Erro na configuração:', error.message);
    }
  }
}

testProductionWebhook();