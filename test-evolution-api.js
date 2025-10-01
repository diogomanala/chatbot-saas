const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function testEvolutionAPI() {
  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
  const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
  const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
  
  console.log('🧪 Testando Evolution API...');
  console.log('URL:', EVOLUTION_API_URL);
  console.log('Instance:', EVOLUTION_INSTANCE);
  console.log('API Key:', EVOLUTION_API_KEY ? 'Configurada' : 'Não configurada');
  
  try {
    // Teste 1: Verificar status da instância
    console.log('\n📡 Teste 1: Verificando status da instância...');
    const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Status Response:', statusResponse.status);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('Instâncias:', JSON.stringify(statusData, null, 2));
    } else {
      console.log('Erro no status:', await statusResponse.text());
    }
    
    // Teste 2: Tentar enviar mensagem de teste
    console.log('\n📤 Teste 2: Tentando enviar mensagem de teste...');
    const testMessage = {
      number: '5511999999999@s.whatsapp.net',
      text: 'Teste de mensagem do motor de fluxos'
    };
    
    console.log('Payload:', JSON.stringify(testMessage, null, 2));
    
    const sendResponse = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage)
    });
    
    console.log('Send Response Status:', sendResponse.status);
    console.log('Send Response Headers:', Object.fromEntries(sendResponse.headers.entries()));
    
    if (sendResponse.ok) {
      const sendData = await sendResponse.json();
      console.log('✅ Mensagem enviada com sucesso:', JSON.stringify(sendData, null, 2));
    } else {
      const errorText = await sendResponse.text();
      console.log('❌ Erro ao enviar mensagem:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testEvolutionAPI();