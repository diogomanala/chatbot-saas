require('dotenv').config({ path: '.env.local' });

const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function fixWebhookConfig() {
  console.log('🔧 Configurando webhook na instância...');
  console.log(`🏢 Instância: ${EVOLUTION_INSTANCE}`);
  console.log(`🌐 Webhook URL: ${WEBHOOK_URL}`);
  console.log('');

  try {
    // Configurar o webhook
    const webhookConfig = {
      webhook: {
        url: WEBHOOK_URL,
        enabled: true,
        events: [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE'
        ]
      }
    };

    console.log('📡 Configurando webhook...');
    const response = await fetch(`${EVOLUTION_BASE_URL}/webhook/set/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookConfig)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook configurado com sucesso!');
      console.log(`📋 Resultado: ${JSON.stringify(result, null, 2)}`);
    } else {
      const errorText = await response.text();
      console.log(`❌ Erro ao configurar webhook: ${response.status}`);
      console.log(`📋 Erro: ${errorText}`);
    }

    // Verificar se a configuração foi aplicada
    console.log('\n🔍 Verificando configuração aplicada...');
    const checkResponse = await fetch(`${EVOLUTION_BASE_URL}/webhook/find/${EVOLUTION_INSTANCE}`, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (checkResponse.ok) {
      const webhookStatus = await checkResponse.json();
      console.log('✅ Status atual do webhook:');
      console.log(`   URL: ${webhookStatus.webhook?.url || 'N/A'}`);
      console.log(`   Habilitado: ${webhookStatus.webhook?.enabled || 'N/A'}`);
      console.log(`   Eventos: ${JSON.stringify(webhookStatus.webhook?.events || [])}`);
    } else {
      console.log(`❌ Erro ao verificar webhook: ${checkResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Erro durante configuração:', error.message);
  }
}

fixWebhookConfig();