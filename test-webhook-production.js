// Teste do webhook para produção
const fetch = require('node-fetch');

async function testProductionWebhook() {
  console.log('🧪 Testando webhook de produção...');
  
  const webhookUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';
  
  const testPayload = {
    event: 'messages.upsert',
    instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
    data: {
      key: {
        remoteJid: '5522997603813@s.whatsapp.net',
        fromMe: false,
        id: 'test_message_' + Date.now()
      },
      message: {
        conversation: 'Olá, esta é uma mensagem de teste para verificar o webhook!'
      },
      messageType: 'conversation',
      messageTimestamp: Date.now(),
      pushName: 'Teste Webhook',
      body: 'Olá, esta é uma mensagem de teste para verificar o webhook!'
    }
  };

  try {
    console.log('📤 Enviando payload de teste para produção...');
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
    
    const responseText = await response.text();
    console.log('📋 Resposta bruta:', responseText);
    
    try {
      const responseData = JSON.parse(responseText);
      console.log('📋 Resposta JSON:', JSON.stringify(responseData, null, 2));
    } catch {
    console.log('⚠️ Resposta não é JSON válido');
  }
    
    if (response.ok) {
      console.log('✅ Teste PASSOU! Webhook de produção funcionando.');
    } else {
      console.log('❌ Teste FALHOU! Erro no webhook de produção.');
    }
    
  } catch (error) {
    console.error('💥 Erro no teste:', error.message);
  }
}

// Executar teste
testProductionWebhook();