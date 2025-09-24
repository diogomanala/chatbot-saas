require('dotenv').config({ path: '.env.local' });

async function checkWebhookConfig() {
  console.log('🔍 Verificando configuração do webhook no Evolution API...\n');
  
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  
  console.log('📋 Configurações atuais:');
  console.log(`   Evolution URL: ${evolutionUrl}`);
  console.log(`   Instance: ${instance}`);
  console.log(`   Webhook URL configurado: ${process.env.WEBHOOK_URL}`);
  console.log(`   Local URL permitido: ${process.env.ALLOW_LOCAL_WEBHOOK}\n`);
  
  try {
    // Verificar status da instância
    console.log('1️⃣ Verificando status da instância...');
    const statusResponse = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!statusResponse.ok) {
      throw new Error(`Erro ao buscar instâncias: ${statusResponse.status}`);
    }
    
    const instances = await statusResponse.json();
    console.log(`   ✅ Instâncias encontradas: ${instances.length}`);
    
    const myInstance = instances.find(inst => inst.instance.instanceName === instance);
    if (myInstance) {
      console.log(`   ✅ Instância encontrada: ${myInstance.instance.instanceName}`);
      console.log(`   📱 Status: ${myInstance.instance.status}`);
      console.log(`   🔗 Conectado: ${myInstance.instance.connectionStatus}\n`);
    } else {
      console.log(`   ❌ Instância ${instance} não encontrada!\n`);
      return;
    }
    
    // Verificar configuração do webhook
    console.log('2️⃣ Verificando configuração do webhook...');
    const webhookResponse = await fetch(`${evolutionUrl}/webhook/find/${instance}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (webhookResponse.ok) {
      const webhookConfig = await webhookResponse.json();
      console.log('   ✅ Configuração do webhook encontrada:');
      console.log(`   📡 URL: ${webhookConfig.url}`);
      console.log(`   🔐 Webhook by Events: ${webhookConfig.webhookByEvents}`);
      console.log(`   📝 Events: ${JSON.stringify(webhookConfig.events, null, 2)}\n`);
    } else {
      console.log('   ❌ Nenhuma configuração de webhook encontrada!\n');
    }
    
    // Testar conectividade com nosso servidor
    console.log('3️⃣ Testando conectividade com nosso servidor...');
    const testUrl = process.env.ALLOW_LOCAL_WEBHOOK === 'true' 
      ? 'http://localhost:3000/api/webhook/evolution'
      : process.env.WEBHOOK_URL;
      
    console.log(`   🎯 Testando URL: ${testUrl}`);
    
    try {
      const testResponse = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          test: true,
          message: 'Teste de conectividade'
        })
      });
      
      console.log(`   📊 Status da resposta: ${testResponse.status}`);
      if (testResponse.ok) {
        console.log('   ✅ Servidor respondendo corretamente!');
      } else {
        console.log('   ⚠️ Servidor respondeu com erro');
      }
    } catch (error) {
      console.log(`   ❌ Erro de conectividade: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar configuração:', error.message);
  }
}

checkWebhookConfig();