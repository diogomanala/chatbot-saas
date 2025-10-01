const fetch = require('node-fetch');

async function testWebhook() {
  console.log('🧪 Testando webhook corrigido...');
  
  const payload = {
    "event": "messages.upsert",
    "instance": "medsimples",
    "data": {
      "key": {
        "remoteJid": "5521967725481@s.whatsapp.net",
        "fromMe": false,
        "id": "test_message_" + Date.now()
      },
      "message": {
        "conversation": "Olá! Teste após correção do banco de dados."
      },
      "messageType": "conversation",
      "messageTimestamp": Date.now(),
      "pushName": "Teste Corrigido",
      "body": "Olá! Teste após correção do banco de dados."
    }
  };

  console.log('📤 Enviando payload de teste...');
  console.log('URL: http://localhost:3000/api/webhook/evolution');
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('http://localhost:3000/api/webhook/evolution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 Status da resposta:', response.status);
    
    const responseText = await response.text();
    console.log('📋 Resposta bruta:', responseText);

    try {
      const responseJson = JSON.parse(responseText);
      console.log('📋 Resposta JSON:', JSON.stringify(responseJson, null, 2));
      
      if (response.status === 200) {
        console.log('✅ Teste PASSOU! Webhook funcionando corretamente.');
      } else {
        console.log('❌ Teste FALHOU! Status:', response.status);
      }
    } catch {
      console.log('⚠️ Resposta não é JSON válido');
      if (response.status === 200) {
        console.log('✅ Teste PASSOU! (Resposta não-JSON mas status 200)');
      } else {
        console.log('❌ Teste FALHOU! Erro no webhook.');
      }
    }

  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
  }
}

testWebhook();