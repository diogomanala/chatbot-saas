const axios = require('axios');

const EVOLUTION_API_URL = 'https://evolution-api-evolution-api.audihb.easypanel.host';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';

async function testRealNumber() {
  console.log('📱 Testando com número real...\n');

  // Use seu próprio número aqui (substitua pelos dígitos corretos)
  const realNumber = '5522997603813'; // SUBSTITUA pelo seu número real

  console.log(`🔍 Testando número: ${realNumber}`);
  console.log('⚠️  IMPORTANTE: Certifique-se de que este número tem WhatsApp ativo!\n');

  try {
    // 1. Primeiro, verificar se o número existe no WhatsApp
    console.log('1. Verificando se o número existe no WhatsApp...');
    
    const checkResponse = await axios.post(
      `${EVOLUTION_API_URL}/chat/whatsappNumbers/${INSTANCE_NAME}`,
      {
        numbers: [realNumber]
      },
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Verificação de número:');
    console.log(JSON.stringify(checkResponse.data, null, 2));

    // 2. Se o número existe, tentar enviar mensagem
    const numberExists = checkResponse.data.some(item => item.exists === true);
    
    if (numberExists) {
      console.log('\n2. Número existe! Enviando mensagem de teste...');
      
      const messagePayload = {
        number: realNumber,
        text: `🧪 Teste de webhook - ${new Date().toLocaleString('pt-BR')}\n\nSe você recebeu esta mensagem, o sistema está funcionando!`
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

      console.log('✅ Mensagem enviada com sucesso!');
      console.log('Status:', sendResponse.status);
      console.log('Resposta:', JSON.stringify(sendResponse.data, null, 2));
      
      console.log('\n📋 PRÓXIMOS PASSOS:');
      console.log('1. Verifique se recebeu a mensagem no WhatsApp');
      console.log('2. Responda a mensagem para testar o webhook');
      console.log('3. Monitore os logs do servidor (npm run dev)');

    } else {
      console.log('\n❌ Número não existe no WhatsApp ou não está disponível');
      console.log('💡 Dicas:');
      console.log('- Verifique se o número está correto');
      console.log('- Certifique-se de que o WhatsApp está ativo neste número');
      console.log('- Tente com outro número que você tenha certeza que funciona');
    }

  } catch (error) {
    console.error('\n❌ Erro:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      console.log('\n💡 Possíveis soluções:');
      console.log('- Verifique se o número está no formato correto (ex: 5511987654321)');
      console.log('- Certifique-se de que o número tem WhatsApp ativo');
      console.log('- Tente com um número que você sabe que funciona');
    }
  }
}

console.log('⚠️  ATENÇÃO: Edite este arquivo e substitua "5511987654321" pelo seu número real!');
console.log('   Formato: código do país + DDD + número (ex: 5511987654321)\n');

testRealNumber();