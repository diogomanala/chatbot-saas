require('dotenv').config({ path: '.env.local' });

async function configureWebhook() {
  const correctInstanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
  const webhookUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';
  const apiKey = process.env.EVOLUTION_API_KEY;
  const baseUrl = process.env.EVOLUTION_API_URL;
  
  console.log('🔧 Configurando webhook na instância correta...');
  console.log('📱 Instância:', correctInstanceName);
  console.log('🔗 Webhook URL:', webhookUrl);
  
  try {
    const response = await fetch(`${baseUrl}/webhook/set/${correctInstanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        webhook: {
          url: webhookUrl,
          enabled: true,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
          webhookByEvents: true,
          webhookBase64: false
        }
      })
    });
    
    console.log('📊 Status:', response.status);
    const result = await response.text();
    console.log('📋 Resposta:', result);
    
    if (response.ok) {
      console.log('✅ Webhook configurado com sucesso!');
    } else {
      console.log('❌ Erro ao configurar webhook');
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

configureWebhook();