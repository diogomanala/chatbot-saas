const axios = require('axios');

async function testRealMessage() {
  try {
    console.log('📱 Simulando mensagem real da Evolution API...\n');
    
    // Simular payload real da Evolution API
    const realPayload = {
      event: 'messages.upsert',
      instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'test-message-' + Date.now(),
          participant: undefined
        },
        message: {
          conversation: 'Olá, preciso de ajuda!'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Usuário Teste',
        broadcast: false,
        messageType: 'conversation'
      }
    };
    
    console.log('📦 Payload da mensagem:');
    console.log(JSON.stringify(realPayload, null, 2));
    console.log('\n🚀 Enviando para webhook...');
    
    const response = await axios.post('http://localhost:3000/api/webhook/evolution', realPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Resposta do webhook:', response.status, response.data);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testRealMessage();