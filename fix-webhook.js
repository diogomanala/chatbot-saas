require('dotenv').config({ path: '.env.local' });

async function fixWebhook() {
  console.log('🔧 Configurando webhook na instância correta...\n');
  
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const correctInstance = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77'; // A que está OPEN
  const webhookUrl = process.env.WEBHOOK_URL;
  
  console.log(`🎯 Configurando webhook para: ${correctInstance}`);
  console.log(`📡 URL do webhook: ${webhookUrl}\n`);
  
  try {
    // Configurar webhook na instância correta
    const webhookConfig = {
      url: webhookUrl,
      enabled: true,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      webhookByEvents: false
    };
    
    console.log('📤 Enviando configuração do webhook...');
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
      console.log('✅ Webhook configurado com sucesso!');
      console.log('📋 Resultado:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.log(`❌ Erro ao configurar webhook: ${response.status}`);
      console.log('📋 Detalhes:', error);
    }
    
    // Verificar se foi configurado corretamente
    console.log('\n🔍 Verificando configuração...');
    const checkResponse = await fetch(`${evolutionUrl}/webhook/find/${correctInstance}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (checkResponse.ok) {
      const webhookConfig = await checkResponse.json();
      console.log('✅ Configuração verificada:');
      console.log(`   📡 URL: ${webhookConfig.url}`);
      console.log(`   🔛 Habilitado: ${webhookConfig.enabled}`);
      console.log(`   📝 Events: ${webhookConfig.events.join(', ')}`);
    } else {
      console.log('❌ Erro ao verificar configuração');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

fixWebhook();