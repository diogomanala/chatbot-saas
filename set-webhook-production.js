require('dotenv').config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_ID = process.env.EVOLUTION_INSTANCE;

// URL do webhook oficial de produção que sempre funcionou
const PRODUCTION_WEBHOOK_URL = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';

async function setWebhookProduction() {
  try {
    console.log('🔧 Restaurando webhook oficial de produção...');
    console.log(`Instance ID: ${INSTANCE_ID}`);
    console.log(`Webhook URL: ${PRODUCTION_WEBHOOK_URL}`);

    const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        webhook: {
          url: PRODUCTION_WEBHOOK_URL,
          enabled: true,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
          webhookByEvents: true,
          webhookBase64: false
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Webhook oficial restaurado com sucesso!');
    console.log(JSON.stringify(result, null, 2));

    // Verificar se foi configurado corretamente
    console.log('\n🔍 Verificando configuração...');
    const checkResponse = await fetch(`${EVOLUTION_API_URL}/webhook/find/${INSTANCE_ID}`, {
      headers: {
        'apikey': EVOLUTION_API_KEY
      }
    });

    if (checkResponse.ok) {
      const webhookConfig = await checkResponse.json();
      console.log('📋 Configuração atual do webhook:');
      console.log(JSON.stringify(webhookConfig, null, 2));
      
      if (webhookConfig.url === PRODUCTION_WEBHOOK_URL) {
        console.log('✅ Webhook oficial confirmado e funcionando!');
      } else {
        console.log('❌ Webhook não está apontando para a URL correta');
      }
    }

  } catch (error) {
    console.error('❌ Erro ao restaurar webhook:', error.message);
    process.exit(1);
  }
}

setWebhookProduction();