const axios = require('axios');

async function testWithRealNumber() {
  try {
    console.log('📱 Testando webhook com número real...\n');
    
    // Usar um número real - substitua pelo seu número ou um número válido
    const realPayload = {
      event: 'messages.upsert',
      instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
      data: {
        key: {
          remoteJid: '5511987654321@s.whatsapp.net', // Substitua por um número real
          fromMe: false,
          id: 'real-message-' + Date.now(),
          participant: undefined
        },
        message: {
          conversation: 'Olá, este é um teste real!'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Teste Real',
        broadcast: false,
        messageType: 'conversation'
      }
    };
    
    console.log('📦 Payload da mensagem real:');
    console.log(JSON.stringify(realPayload, null, 2));
    console.log('\n🚀 Enviando para webhook local...');
    
    const response = await axios.post('http://localhost:3000/api/webhook/evolution', realPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Resposta do webhook:', response.status, response.data);
    
    // Também testar a sub-rota
    console.log('\n🔄 Testando sub-rota messages-upsert...');
    const subRouteResponse = await axios.post('http://localhost:3000/api/webhook/evolution/messages-upsert', realPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Resposta da sub-rota:', subRouteResponse.status, subRouteResponse.data);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testWithRealNumber();