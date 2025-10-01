const axios = require('axios');

async function testWebhook() {
  try {
    console.log('🧪 Testando o motor de execução de fluxos...');
    
    // Simular uma mensagem recebida via webhook
    const webhookPayload = {
      event: 'messages.upsert',
      instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'test-message-id-' + Date.now()
        },
        message: {
          conversation: 'oi'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Usuário Teste'
      }
    };

    console.log('📤 Enviando payload para o webhook...');
    console.log('Mensagem:', webhookPayload.data.message.conversation);
    console.log('Telefone:', webhookPayload.data.key.remoteJid);

    const response = await axios.post('http://localhost:3000/api/webhook/evolution', webhookPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ Resposta do webhook:', response.status);
    console.log('📋 Dados da resposta:', response.data);

    console.log('\n🔍 Verificando se o fluxo foi executado...');
    console.log('- Verifique os logs do servidor Next.js');
    console.log('- Procure por mensagens como "🎯 Fluxo correspondente encontrado"');
    console.log('- Verifique se uma sessão foi criada na tabela chat_sessions');

  } catch (error) {
    console.error('❌ Erro ao testar webhook:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    }
  }
}

testWebhook();