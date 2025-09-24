const axios = require('axios');

const EVOLUTION_API_URL = 'https://evolution-api-production-b8e8.up.railway.app';
const EVOLUTION_API_KEY = 'B6D711FCDE4D4FD5936544120E713976';

async function checkInstancesStatus() {
  console.log('🔍 Verificando status das instâncias...\n');

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
      console.log(`   Owner: ${instance.owner}`);
      console.log('');
    });

    // 2. Verificar instância específica
    const targetInstance = instancesResponse.data.find(
      instance => instance.name === 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77'
    );

    if (targetInstance) {
      console.log('2. Verificando instância específica...');
      console.log(`✅ Instância encontrada: ${targetInstance.name}`);
      console.log(`   Status: ${targetInstance.connectionStatus}`);
      console.log(`   ID: ${targetInstance.id}`);
      
      // 3. Verificar webhook da instância
      console.log('\n3. Verificando webhook da instância...');
      try {
        const webhookResponse = await axios.get(
          `${EVOLUTION_API_URL}/webhook/find/${targetInstance.name}`,
          {
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('✅ Configuração do webhook:');
        console.log(JSON.stringify(webhookResponse.data, null, 2));
      } catch (webhookError) {
        console.log('❌ Erro ao verificar webhook:', webhookError.response?.data || webhookError.message);
      }
    } else {
      console.log('❌ Instância medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77 não encontrada');
    }

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

checkInstancesStatus();