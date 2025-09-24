require('dotenv').config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function revertWebhookToProduction() {
  try {
    console.log('🔄 [REVERT] Revertendo webhook para URL de produção...');
    console.log(`📋 [CONFIG] Configurando webhook para: ${WEBHOOK_URL}`);

    const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        enabled: true,
        events: [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE'
        ],
        webhookByEvents: true,
        webhookBase64: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ [SUCCESS] Webhook revertido com sucesso!');
    console.log('📋 [RESPONSE] Resposta:', JSON.stringify(result, null, 2));

    // Verificar se a configuração foi aplicada
    console.log('\n🔍 [VERIFY] Verificando configuração aplicada...');
    const verifyResponse = await fetch(`${EVOLUTION_API_URL}/webhook/find/${EVOLUTION_INSTANCE}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY
      }
    });

    if (verifyResponse.ok) {
      const verifyResult = await verifyResponse.json();
      console.log('✅ [VERIFY] Configuração atual:', JSON.stringify(verifyResult, null, 2));
    }

  } catch (error) {
    console.error('❌ [ERROR] Erro ao reverter webhook:', error.message);
  }
}

revertWebhookToProduction();