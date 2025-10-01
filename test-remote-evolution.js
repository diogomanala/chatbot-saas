const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Testando Evolution API remota...\n');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

console.log('URL:', EVOLUTION_API_URL);
console.log('Instance:', EVOLUTION_INSTANCE);
console.log('API Key:', EVOLUTION_API_KEY ? '✅ Definida' : '❌ Não definida');

async function testRemoteEvolution() {
  try {
    console.log('\n1. Testando status da instância...');
    
    const statusResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY
        },
        timeout: 10000
      }
    );

    console.log('✅ Status da instância:', statusResponse.status);
    console.log('Estado:', statusResponse.data);

    // Testar envio de mensagem
    console.log('\n2. Testando envio de mensagem...');
    
    const messagePayload = {
      number: '5521967725481',
      text: 'Teste do projeto restaurado - Evolution API remota funcionando!'
    };

    const messageResponse = await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      messagePayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        timeout: 15000
      }
    );

    console.log('✅ Mensagem enviada:', messageResponse.status);
    console.log('Response:', messageResponse.data);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testRemoteEvolution();