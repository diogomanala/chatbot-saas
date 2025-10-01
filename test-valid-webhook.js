require('dotenv').config();

async function testValidWebhook() {
  const webhookUrl = 'http://localhost:3000/api/webhook/evolution/messages-upsert';
  const validNumber = '5522997603813@s.whatsapp.net';
  
  const payload = {
    instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
    data: {
      key: {
        remoteJid: validNumber,
        fromMe: false,
        id: `test_valid_number_${Date.now()}`
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: {
        conversation: 'Olá, preciso de ajuda médica'
      },
      pushName: 'Paciente Teste'
    }
  };
  
  console.log('Testando webhook com número válido...');
  console.log('URL:', webhookUrl);
  console.log('Número:', validNumber);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log('\n--- RESPOSTA DO WEBHOOK ---');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    console.log('Response OK?', response.ok);
    
    if (response.ok) {
      console.log('✅ Webhook processado com sucesso!');
    } else {
      console.log('❌ Webhook falhou');
    }
    
  } catch (error) {
    console.error('Erro ao testar webhook:', error.message);
  }
}

testValidWebhook();