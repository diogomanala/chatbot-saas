const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE;

async function debugWebhookStatus() {
  console.log('🔍 Verificando status detalhado do webhook e instância...\n');
  
  try {
    // 1. Verificar status da instância
    console.log('📱 1. Verificando status da instância:');
    const instanceResponse = await axios.get(
      `${EVOLUTION_API_URL}/instance/fetchInstances`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY
        }
      }
    );
    
    console.log('📋 Resposta da API:', JSON.stringify(instanceResponse.data, null, 2));
    
    const instances = instanceResponse.data;
    let currentInstance = null;
    
    // Tentar diferentes estruturas de resposta
    if (Array.isArray(instances)) {
      currentInstance = instances.find(inst => 
        (inst.instance && inst.instance.instanceName === INSTANCE_NAME) ||
        (inst.instanceName === INSTANCE_NAME) ||
        (inst.name === INSTANCE_NAME)
      );
    } else if (instances.instance) {
      currentInstance = instances.instance.instanceName === INSTANCE_NAME ? instances : null;
    } else if (instances.instanceName === INSTANCE_NAME) {
      currentInstance = instances;
    }
    
    if (currentInstance) {
      console.log(`   ✅ Instância encontrada: ${INSTANCE_NAME}`);
      
      // Tentar diferentes estruturas para obter status
      const instanceData = currentInstance.instance || currentInstance;
      console.log(`   📊 Status: ${instanceData.status || instanceData.state || 'N/A'}`);
      console.log(`   🔗 Conectado: ${instanceData.connectionStatus || instanceData.connection || 'N/A'}`);
      console.log(`   📞 Número: ${instanceData.number || instanceData.phone || 'N/A'}`);
    } else {
      console.log(`   ❌ Instância ${INSTANCE_NAME} não encontrada!`);
      console.log('   📋 Estrutura da resposta:', typeof instances);
      
      if (Array.isArray(instances)) {
        console.log('   📋 Instâncias disponíveis:');
        instances.forEach((inst, index) => {
          const instanceData = inst.instance || inst;
          const name = instanceData.instanceName || instanceData.name || `Instância ${index}`;
          const status = instanceData.status || instanceData.state || 'N/A';
          console.log(`      - ${name} (${status})`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(50));
    
    // 2. Verificar configuração do webhook
    console.log('🔗 2. Verificando configuração do webhook:');
    const webhookResponse = await axios.get(
      `${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`,
      {
        headers: {
          'apikey': EVOLUTION_API_KEY
        }
      }
    );
    
    const webhook = webhookResponse.data;
    console.log(`   📍 URL: ${webhook.url}`);
    console.log(`   ✅ Habilitado: ${webhook.enabled}`);
    console.log(`   📋 Eventos: ${webhook.events.join(', ')}`);
    
    // Verificar se a URL está correta
    const expectedUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';
    if (webhook.url === expectedUrl) {
      console.log('   ✅ URL do webhook está correta para produção');
    } else {
      console.log('   ⚠️ URL do webhook pode estar incorreta');
      console.log(`   🎯 URL esperada: ${expectedUrl}`);
    }
    
    console.log('\n' + '='.repeat(50));
    
    // 3. Testar conectividade do webhook
    console.log('🌐 3. Testando conectividade do webhook:');
    try {
      const testResponse = await axios.post(webhook.url, {
        test: true,
        timestamp: new Date().toISOString()
      }, {
        timeout: 10000
      });
      
      console.log(`   ✅ Webhook respondeu: ${testResponse.status}`);
      console.log(`   📄 Resposta: ${JSON.stringify(testResponse.data)}`);
    } catch (webhookError) {
      console.log(`   ❌ Erro ao testar webhook: ${webhookError.message}`);
      if (webhookError.code === 'ECONNABORTED') {
        console.log('   ⏱️ Timeout - webhook pode estar lento');
      } else if (webhookError.response) {
        console.log(`   📊 Status HTTP: ${webhookError.response.status}`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    
    // 4. Verificar logs recentes da Evolution API (se disponível)
    console.log('📋 4. Tentando verificar logs da Evolution API:');
    try {
      const logsResponse = await axios.get(
        `${EVOLUTION_API_URL}/instance/logs/${INSTANCE_NAME}`,
        {
          headers: {
            'apikey': EVOLUTION_API_KEY
          }
        }
      );
      
      console.log('   ✅ Logs obtidos com sucesso');
      console.log('   📄 Últimas entradas:', JSON.stringify(logsResponse.data, null, 2));
    } catch (logsError) {
      console.log('   ⚠️ Não foi possível obter logs da Evolution API');
      console.log(`   📝 Motivo: ${logsError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    if (error.response) {
      console.error('📊 Status:', error.response.status);
      console.error('📄 Dados:', error.response.data);
    }
  }
}

debugWebhookStatus();