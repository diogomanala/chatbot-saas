const axios = require('axios');

const EVOLUTION_API_URL = 'https://evolution-api-evolution-api.audihb.easypanel.host';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
const WEBHOOK_URL = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';

async function fixWebhookWithCorrectFormat() {
  console.log('🔧 Corrigindo configuração do webhook com formato correto...\n');

  try {
    console.log('1. Problema identificado:');
    console.log('   - webhookByEvents: true está causando tentativas de acesso a sub-rotas');
    console.log('   - URL atual: https://saas-chatbot-production.vercel.app/api/webhook');
    console.log('   - Tentativas de acesso: /api/webhook/evolution/connection-update (404)\n');

    console.log('2. Aplicando correção com formato correto...');
    
    // Formato correto baseado no erro "instance requires property webhook"
    const webhookConfig = {
      webhook: {
        url: WEBHOOK_URL,
        enabled: true,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        webhookByEvents: false, // IMPORTANTE: Desabilitar sub-rotas
        webhookBase64: false
      }
    };

    console.log('   Nova configuração:');
    console.log(`   - URL: ${WEBHOOK_URL}`);
    console.log('   - webhookByEvents: false (todos eventos na mesma URL)');
    console.log('   - Formato: { webhook: { ... } }\n');

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
    if (config.webhookByEvents === false) {
      console.log('\n🎉 PROBLEMA RESOLVIDO!');
      console.log('   ✓ webhookByEvents: false');
      console.log('   ✓ URL correta: ' + config.url);
      console.log('   ✓ Não haverá mais tentativas de sub-rotas');
      console.log('   ✓ Erro "Route not found" deve parar');
    }

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    if (error.response?.data?.response?.message) {
      console.error('Detalhes do erro:', error.response.data.response.message);
    }
  }
}

fixWebhookWithCorrectFormat();