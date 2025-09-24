const axios = require('axios');

const EVOLUTION_API_URL = 'https://evolution-api-evolution-api.audihb.easypanel.host';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
const WEBHOOK_URL = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';

async function testCorrectAPI() {
  console.log('🔍 Testando com credenciais corretas do .env...\n');

  try {
    // 1. Listar todas as instâncias
    console.log('1. Listando todas as instâncias...');
    const instancesResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/fetchInstances`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Instâncias encontradas:');
    instancesResponse.data.forEach((instance, index) => {
      console.log(`${index + 1}. Nome: ${instance.name}`);
      console.log(`   Status: ${instance.connectionStatus}`);
      console.log(`   ID: ${instance.id}`);
      console.log('');
    });

    // 2. Verificar instância específica
    const targetInstance = instancesResponse.data.find(
      instance => instance.name === INSTANCE_NAME
    );

    if (targetInstance) {
      console.log('2. Verificando instância específica...');
      console.log(`✅ Instância encontrada: ${targetInstance.name}`);
      console.log(`   Status: ${targetInstance.connectionStatus}`);
      
      // 3. Verificar webhook atual
      console.log('\n3. Verificando webhook atual...');
      try {
        const webhookResponse = await axios.get(
          `${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`,
          {
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('✅ Configuração atual do webhook:');
        console.log(JSON.stringify(webhookResponse.data, null, 2));
        
        // 4. Configurar webhook corretamente (sem webhookByEvents)
        console.log('\n4. Configurando webhook sem sub-rotas...');
        const webhookConfig = {
          url: WEBHOOK_URL,
          enabled: true,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
          webhookByEvents: false // IMPORTANTE: Desabilitar sub-rotas
        };

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

        console.log('✅ Webhook reconfigurado:');
        console.log(JSON.stringify(setWebhookResponse.data, null, 2));
        
        // 5. Verificar nova configuração
        console.log('\n5. Verificando nova configuração...');
        const updatedWebhookResponse = await axios.get(
          `${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`,
          {
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('✅ Nova configuração confirmada:');
        console.log(JSON.stringify(updatedWebhookResponse.data, null, 2));
        
      } catch (webhookError) {
        console.log('❌ Erro ao verificar/configurar webhook:', webhookError.response?.data || webhookError.message);
      }
    } else {
      console.log(`❌ Instância ${INSTANCE_NAME} não encontrada`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testCorrectAPI();