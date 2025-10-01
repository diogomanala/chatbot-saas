require('dotenv').config();
const axios = require('axios');

async function testEvolutionAPI() {
  try {
    console.log('🔍 Testando Evolution API diretamente...\n');
    
    const evolutionApiUrl = process.env.EVOLUTION_API_URL;
    const evolutionApiKey = process.env.EVOLUTION_API_KEY;
    const instanceId = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    
    console.log('🔧 Configurações:');
    console.log('URL:', evolutionApiUrl);
    console.log('API Key:', evolutionApiKey ? 'Configurada' : 'NÃO CONFIGURADA');
    console.log('Instance ID:', instanceId);
    console.log('');
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('❌ Configurações da Evolution API não encontradas!');
      return;
    }
    
    // Testar envio de mensagem
    const payload = {
      number: '5511999999999',
      text: 'Teste de mensagem via API'
    };
    
    console.log('📦 Payload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('');
    
    const url = `${evolutionApiUrl}/message/sendText/${instanceId}`;
    console.log('🚀 URL completa:', url);
    console.log('');
    
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      }
    });
    
    console.log('✅ Resposta da Evolution API:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Erro ao testar Evolution API:');
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      // Mostrar detalhes específicos do erro
      if (error.response.data && error.response.data.response && error.response.data.response.message) {
        console.error('Detalhes do erro:', JSON.stringify(error.response.data.response.message, null, 2));
      }
    }
  }
}

testEvolutionAPI();