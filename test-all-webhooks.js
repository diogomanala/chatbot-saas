require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'https://saas-chatbot-production.vercel.app';

const webhookEndpoints = [
  '/api/webhook/evolution/connection-update',
  '/api/webhook/evolution/messages-update', 
  '/api/webhook/evolution/messages-upsert'
];

const testPayload = {
  instance: {
    instanceName: "medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77"
  },
  state: "open",
  statusReason: "connected"
};

async function testWebhookEndpoint(endpoint) {
  console.log(`\n🔄 [TEST] Testando endpoint: ${endpoint}`);
  
  try {
    // Teste POST
    const postResponse = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`📊 [POST] Status: ${postResponse.status}`);
    console.log(`📊 [POST] Headers:`, Object.fromEntries(postResponse.headers.entries()));
    
    if (postResponse.status === 200) {
      console.log(`✅ [POST] Endpoint funcionando corretamente!`);
    } else {
      console.log(`❌ [POST] Erro: ${postResponse.status}`);
    }

    // Teste GET
    const getResponse = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET'
    });

    console.log(`📊 [GET] Status: ${getResponse.status}`);
    
    if (getResponse.status === 200) {
      console.log(`✅ [GET] Endpoint acessível!`);
    } else {
      console.log(`❌ [GET] Erro: ${getResponse.status}`);
    }

  } catch (error) {
    console.error(`❌ [ERROR] Falha ao testar ${endpoint}:`, error.message);
  }
}

async function testAllWebhooks() {
  console.log('🚀 [TEST] Iniciando teste de todos os endpoints de webhook...\n');
  
  for (const endpoint of webhookEndpoints) {
    await testWebhookEndpoint(endpoint);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1s entre testes
  }
  
  console.log('\n✨ [TEST] Teste de todos os endpoints concluído!');
}

testAllWebhooks().catch(console.error);