require('dotenv').config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_ID = process.env.EVOLUTION_INSTANCE;

// URL do webhook local
const LOCAL_WEBHOOK_URL = 'http://localhost:3000/api/webhook/evolution';

async function setWebhookLocal() {
  try {
    console.log('🔧 Configurando webhook para servidor local...');
    console.log(`Instance ID: ${INSTANCE_ID}`);
    console.log(`Webhook URL: ${LOCAL_WEBHOOK_URL}`);

    const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        webhook: {
          url: LOCAL_WEBHOOK_URL,
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
    console.log('✅ Webhook configurado com sucesso!');
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
    }

  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error.message);
    process.exit(1);
  }
}

setWebhookLocal();