require('dotenv').config({ path: '.env.local' });

async function restoreProductionWebhook() {
  console.log('🔧 Restaurando webhook para produção (método robusto)...\n');
  
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const correctInstance = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
  const productionWebhookUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';
  
  console.log(`🎯 Instância: ${correctInstance}`);
  console.log(`📡 Restaurando para: ${productionWebhookUrl}\n`);
  
  try {
    // Método robusto: usar a estrutura correta do webhook
    const webhookConfig = {
      webhook: {
        url: productionWebhookUrl,
        enabled: true,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        webhookByEvents: false
      }
    };
    
    console.log('📤 Configurando webhook de produção...');
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
      console.log('✅ Webhook de produção configurado!');
      console.log('📋 Resultado:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.log(`❌ Erro: ${response.status}`);
      console.log('📋 Detalhes:', error);
    }
    
    // Verificar configuração final
    console.log('\n🔍 Verificando configuração final...');
    const checkResponse = await fetch(`${evolutionUrl}/webhook/find/${correctInstance}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (checkResponse.ok) {
      const config = await checkResponse.json();
      console.log('✅ Configuração final:');
      console.log(`   📡 URL: ${config.url}`);
      console.log(`   🔛 Habilitado: ${config.enabled}`);
      console.log(`   📝 Events: ${config.events.join(', ')}`);
      
      if (config.url === productionWebhookUrl) {
        console.log('\n🎉 PERFEITO! Webhook restaurado para produção.');
        console.log('📱 Suas mensagens do WhatsApp agora vão para o servidor de produção.');
        console.log('💡 Para testar localmente, use: node send-test-message.js');
      } else {
        console.log('\n⚠️  URL não corresponde ao esperado.');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

restoreProductionWebhook();