const axios = require('axios');

// Simular uma mensagem recebida do WhatsApp
const testWebhookPayload = {
  event: 'messages.upsert',
  instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
  data: {
    key: {
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: false,
      id: 'test-message-' + Date.now()
    },
    message: {
      conversation: 'Olá, teste de webhook!'
    },
    messageTimestamp: Math.floor(Date.now() / 1000)
  }
};

async function testWebhookDirect() {
  console.log('🧪 Testando webhook diretamente...\n');

  try {
    console.log('📤 Enviando payload para webhook local:');
    console.log(JSON.stringify(testWebhookPayload, null, 2));
    
    const response = await axios.post(
      'http://localhost:3000/api/webhook/evolution',
      testWebhookPayload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('\n✅ Resposta do webhook:');
    console.log('Status:', response.status);
    console.log('Data:', response.data);

  } catch (error) {
    console.error('\n❌ Erro ao testar webhook:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Erro:', error.message);
    }
  }
}

// Também testar conexão update
async function testConnectionUpdate() {
  console.log('\n🔗 Testando connection update...\n');

  const connectionPayload = {
    event: 'connection.update',
    instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
    data: {
      state: 'open'
    }
  };

  try {
    console.log('📤 Enviando payload de conexão:');
    console.log(JSON.stringify(connectionPayload, null, 2));
    
    const response = await axios.post(
      'http://localhost:3000/api/webhook/evolution',
      connectionPayload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('\n✅ Resposta do connection update:');
    console.log('Status:', response.status);
    console.log('Data:', response.data);

  } catch (error) {
    console.error('\n❌ Erro ao testar connection update:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Erro:', error.message);
    }
  }
}

async function runTests() {
  await testWebhookDirect();
  await testConnectionUpdate();
}

runTests();