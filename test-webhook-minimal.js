// Teste do webhook minimalista
const fetch = require('node-fetch');

async function testWebhook() {
  console.log('🧪 Testando webhook minimalista...');
  
  const webhookUrl = 'http://localhost:3000/api/webhook/evolution/messages-upsert';
  
  const testPayload = {
    data: {
      message: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net'
        },
        message: {
          conversation: 'Olá, esta é uma mensagem de teste!'
        }
      }
    }
  };

  try {
    console.log('📤 Enviando payload de teste...');
    console.log('URL:', webhookUrl);
    console.log('Payload:', JSON.stringify(testPayload, null, 2));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log('📥 Status da resposta:', response.status);
    
    const responseData = await response.json();
    console.log('📋 Resposta completa:', JSON.stringify(responseData, null, 2));
    
    if (response.ok) {
      console.log('✅ Teste PASSOU! Webhook funcionando corretamente.');
    } else {
      console.log('❌ Teste FALHOU! Erro no webhook.');
    }
    
  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
  }
}

// Executar teste
testWebhook();