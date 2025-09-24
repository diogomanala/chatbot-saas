require('dotenv').config({ path: '.env.local' });

async function configureLocalWebhook() {
  console.log('🔧 Configurando webhook para desenvolvimento local...\n');
  
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const correctInstance = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
  
  // URL local para desenvolvimento
  const localWebhookUrl = 'http://localhost:3000/api/webhook/evolution';
  
  console.log(`🎯 Instância: ${correctInstance}`);
  console.log(`📡 Configurando webhook para: ${localWebhookUrl}\n`);
  
  try {
    const webhookConfig = {
      webhook: {
        url: localWebhookUrl,
        enabled: true,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        webhookByEvents: false
      }
    };
    
    console.log('📤 Enviando configuração...');
    const response = await fetch(`${evolutionUrl}/webhook/set/${correctInstance}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookConfig)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook configurado para desenvolvimento local!');
      console.log('📋 Resultado:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.log(`❌ Erro: ${response.status}`);
      console.log('📋 Detalhes:', error);
    }
    
    // Verificar configuração
    console.log('\n🔍 Verificando nova configuração...');
    const checkResponse = await fetch(`${evolutionUrl}/webhook/find/${correctInstance}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (checkResponse.ok) {
      const config = await checkResponse.json();
      console.log('✅ Nova configuração:');
      console.log(`   📡 URL: ${config.url}`);
      console.log(`   🔛 Habilitado: ${config.enabled}`);
      console.log(`   📝 Events: ${config.events.join(', ')}`);
      
      if (config.url.includes('localhost')) {
        console.log('\n🎉 SUCESSO! Webhook configurado para desenvolvimento local.');
        console.log('📱 Agora suas mensagens do WhatsApp devem chegar ao servidor local!');
      } else {
        console.log('\n⚠️  Webhook ainda aponta para produção. Pode ser necessário usar ngrok.');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

configureLocalWebhook();