const axios = require('axios');

const EVOLUTION_API_URL = 'https://evolution-api-evolution-api.audihb.easypanel.host';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';

async function debugSendMessage() {
  console.log('🔍 Debugando envio de mensagens...\n');

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

    console.log(`✅ Instância: ${targetInstance.name}`);
    console.log(`   Status: ${targetInstance.connectionStatus}`);
    console.log(`   Owner: ${targetInstance.owner || 'N/A'}`);

    // 2. Testar diferentes formatos de número
    const testNumbers = [
      '5511999999999',
      '5511999999999@s.whatsapp.net',
      '+5511999999999',
      '11999999999'
    ];

    for (const number of testNumbers) {
      console.log(`\n📱 Testando número: ${number}`);
      
      const messagePayload = {
        number: number,
        text: `Teste de envio - ${new Date().toLocaleString('pt-BR')}`
      };

      try {
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

        console.log(`✅ Sucesso para ${number}:`, sendResponse.status);
        console.log('   Resposta:', sendResponse.data);
        break; // Se funcionou, para o loop

      } catch (error) {
        console.log(`❌ Erro para ${number}:`, error.response?.status || error.message);
        if (error.response?.data) {
          console.log('   Detalhes:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }

    // 3. Testar endpoint de informações da instância
    console.log('\n3. Verificando informações detalhadas da instância...');
    try {
      const instanceInfoResponse = await axios.get(
        `${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`,
        {
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Informações da instância:');
      console.log(JSON.stringify(instanceInfoResponse.data, null, 2));

    } catch (error) {
      console.log('❌ Erro ao obter informações da instância:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('   Detalhes:', JSON.stringify(error.response.data, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.response?.data || error.message);
  }
}

debugSendMessage();