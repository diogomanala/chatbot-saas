require('dotenv').config();
const axios = require('axios');

async function checkInstanceStatus() {
  try {
    console.log('🔍 Verificando status da instância do WhatsApp...\n');
    
    const evolutionApiUrl = process.env.EVOLUTION_API_URL;
    const evolutionApiKey = process.env.EVOLUTION_API_KEY;
    const instanceId = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    
    console.log('🔧 Configurações:');
    console.log('URL:', evolutionApiUrl);
    console.log('Instance ID:', instanceId);
    console.log('');
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('❌ Configurações da Evolution API não encontradas!');
      return;
    }
    
    // Verificar status da instância
    const statusUrl = `${evolutionApiUrl}/instance/connectionState/${instanceId}`;
    console.log('🚀 Verificando status em:', statusUrl);
    
    const statusResponse = await axios.get(statusUrl, {
      headers: {
        'apikey': evolutionApiKey
      }
    });
    
    console.log('✅ Status da instância:');
    console.log(JSON.stringify(statusResponse.data, null, 2));
    console.log('');
    
    // Verificar informações da instância
    const infoUrl = `${evolutionApiUrl}/instance/fetchInstances`;
    console.log('🔍 Buscando informações das instâncias...');
    
    const infoResponse = await axios.get(infoUrl, {
      headers: {
        'apikey': evolutionApiKey
      }
    });
    
    console.log('📋 Instâncias disponíveis:');
    const instances = infoResponse.data;
    
    if (Array.isArray(instances)) {
      instances.forEach(instance => {
        console.log(`- ${instance.instanceName || instance.instance?.instanceName}: ${instance.connectionStatus || instance.instance?.connectionStatus}`);
      });
      
      const targetInstance = instances.find(i => 
        (i.instanceName === instanceId) || 
        (i.instance?.instanceName === instanceId)
      );
      
      if (targetInstance) {
        console.log('\n🎯 Instância alvo encontrada:');
        console.log(JSON.stringify(targetInstance, null, 2));
      } else {
        console.log(`\n❌ Instância ${instanceId} não encontrada!`);
      }
    } else {
      console.log(JSON.stringify(instances, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar instância:');
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkInstanceStatus();