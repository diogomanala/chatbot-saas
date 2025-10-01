const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function checkWebhookConfig() {
  try {
    console.log('🔍 Verificando configuração detalhada do webhook...\n');
    
    const response = await axios.get(
      `${process.env.EVOLUTION_API_URL}/webhook/find/medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77`,
      {
        headers: {
          'apikey': process.env.EVOLUTION_API_KEY
        }
      }
    );
    
    console.log('✅ Configuração completa do webhook:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verificar se webhookByEvents está ativo
    if (response.data.webhookByEvents) {
      console.log('\n⚠️  ATENÇÃO: webhookByEvents está ATIVO!');
      console.log('Isso significa que a Evolution API está tentando enviar para subrotas específicas:');
      console.log('- CONNECTION_UPDATE → /api/webhook/evolution/connection-update');
      console.log('- MESSAGES_UPSERT → /api/webhook/evolution/messages-upsert');
      console.log('- etc...');
    } else {
      console.log('\n✅ webhookByEvents está DESATIVO - usando rota principal');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

checkWebhookConfig();