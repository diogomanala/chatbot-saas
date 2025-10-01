const axios = require('axios');

const EVOLUTION_API_URL = 'https://evolution-api-evolution-api.audihb.easypanel.host';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
const WEBHOOK_URL = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';

async function fixWebhookConfiguration() {
  console.log('🔧 Corrigindo configuração do webhook...\n');

  try {
    console.log('1. Configuração atual identificada:');
    console.log('   - URL: https://saas-chatbot-production.vercel.app/api/webhook');
    console.log('   - webhookByEvents: true (PROBLEMA!)');
    console.log('   - Isso causa tentativas de acesso a sub-rotas inexistentes\n');

    console.log('2. Aplicando correção...');
    const webhookConfig = {
      url: WEBHOOK_URL, // URL correta com /evolution
      enabled: true,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      webhookByEvents: false, // DESABILITAR sub-rotas
      webhookBase64: false
    };

    console.log('   Nova configuração:');
    console.log(`   - URL: ${WEBHOOK_URL}`);
    console.log('   - webhookByEvents: false (CORRIGIDO!)');
    console.log('   - Todos os eventos irão para a mesma URL\n');

    const setWebhookResponse = await axios.post(
      `${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`,
      webhookConfig,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Webhook reconfigurado com sucesso!');
    console.log(JSON.stringify(setWebhookResponse.data, null, 2));
    
    // Verificar nova configuração
    console.log('\n3. Verificando nova configuração...');
    const updatedWebhookResponse = await axios.get(
      `${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Configuração confirmada:');
    console.log(JSON.stringify(updatedWebhookResponse.data, null, 2));
    
    const config = updatedWebhookResponse.data;
    if (config.webhookByEvents === false && config.url === WEBHOOK_URL) {
      console.log('\n🎉 CORREÇÃO APLICADA COM SUCESSO!');
      console.log('   - Não haverá mais tentativas de acesso a sub-rotas');
      console.log('   - Todos os eventos irão para /api/webhook/evolution');
      console.log('   - O erro "Route not found" deve parar de aparecer');
    } else {
      console.log('\n⚠️ Configuração pode não ter sido aplicada corretamente');
    }

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    if (error.response?.data?.response?.message) {
      console.error('Detalhes:', error.response.data.response.message);
    }
  }
}

fixWebhookConfiguration();