require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ [TEST-ERROR] Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Simular payload do Evolution API
const mockPayload = {
  instance: 'test-instance-123',
  data: {
    key: {
      id: 'msg_' + Date.now(),
      remoteJid: '5522997603813@s.whatsapp.net'
    },
    message: {
      conversation: 'Olá, teste de mensagem!'
    },
    messageTimestamp: Math.floor(Date.now() / 1000)
  }
};

async function testWebhookLogic() {
  console.log('🧪 [TEST] Iniciando simulação do webhook...');
  console.log('📋 [TEST] Payload simulado:', JSON.stringify(mockPayload, null, 2));
  
  try {
    // Extrair dados do payload
    const instanceName = mockPayload.instance;
    const messageData = mockPayload.data;
    const correlationId = messageData.key.id;
    const phoneNumber = messageData.key.remoteJid;
    const messageText = messageData.message?.conversation || 'Mensagem sem texto';
    const messageType = messageData.message?.conversation ? 'text' : 'other';
    
    console.log('📊 [TEST] Dados extraídos:', {
      instanceName,
      correlationId,
      phoneNumber,
      messageText,
      messageType
    });
    
    // 1. Buscar device por session_name (simulando autocorreção)
    console.log('🔍 [TEST] Buscando device por session_name...');
    const { data: deviceBySession, error: sessionError } = await supabase
      .from('devices')
      .select('*')
      .eq('session_name', instanceName)
      .single();
    
    let device = deviceBySession;
    let configStatus = 'found';
    
    if (sessionError || !device) {
      console.log('⚠️ [TEST] Device não encontrado, simulando criação...');
      configStatus = 'created';
      
      // Buscar chatbot default
      const { data: defaultChatbot, error: chatbotError } = await supabase
        .from('chatbots')
        .select('*')
        .eq('is_default', true)
        .single();
      
      if (chatbotError || !defaultChatbot) {
        console.error('❌ [TEST] Chatbot default não encontrado:', chatbotError);
        return;
      }
      
      console.log('✅ [TEST] Chatbot default encontrado:', defaultChatbot.name);
      
      // Simular criação de device
      device = {
        id: 'simulated-device-' + Date.now(),
        org_id: defaultChatbot.org_id,
        name: `Device ${instanceName}`,
        session_name: instanceName,
        chatbot_id: defaultChatbot.id,
        // Campos que seriam adicionados na migração:
        instance_id: instanceName,
        phone_jid: phoneNumber,
        config: {
          auto_created: true,
          created_at: new Date().toISOString(),
          correlation_id: correlationId
        }
      };
      
      console.log('🔧 [TEST] Device simulado criado:', device);
    } else {
      console.log('✅ [TEST] Device encontrado:', device.name);
    }
    
    // 2. Buscar chatbot default
    console.log('🤖 [TEST] Buscando chatbot default...');
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('*')
      .eq('is_default', true)
      .single();
    
    if (chatbotError || !chatbot) {
      console.error('❌ [TEST] Erro ao buscar chatbot default:', chatbotError);
      return;
    }
    
    console.log('✅ [TEST] Chatbot default encontrado:', chatbot.name);
    
    // 3. Buscar device real existente
     console.log('📱 [TEST] Buscando device real existente...');
     const { data: existingDevices, error: deviceError } = await supabase
       .from('devices')
       .select('*')
       .eq('org_id', chatbot.org_id)
       .limit(1);
     
     if (deviceError || !existingDevices || existingDevices.length === 0) {
       console.error('❌ [TEST] Nenhum device encontrado na org:', deviceError);
       return;
     }
     
     const realDevice = existingDevices[0];
     console.log('✅ [TEST] Device real encontrado:', {
       id: realDevice.id,
       name: realDevice.name,
       org_id: realDevice.org_id,
       session_name: realDevice.session_name
     });
     
     // 4. Simular salvamento de mensagem
     console.log('💾 [TEST] Simulando salvamento de mensagem...');
    const messagePayload = {
       org_id: chatbot.org_id,
       chatbot_id: chatbot.id,
       device_id: realDevice.id,
      phone_number: phoneNumber.replace('@s.whatsapp.net', ''),
      message_content: messageText,
      direction: 'inbound',
      status: 'received',
      external_id: `upsert_${correlationId}`,
      metadata: {
        device_name: realDevice.name,
        chatbot_name: chatbot.name,
        webhook_timestamp: new Date().toISOString(),
        message_key: messageData.key,
        correlation_id: correlationId,
        instance_name: instanceName,
        phone_jid: phoneNumber,
        message_type: messageType,
        config_status: configStatus,
        env: process.env.NODE_ENV || 'development',
        commit: 'test-simulation'
      }
    };
    
    console.log('📋 [TEST] Payload da mensagem:', JSON.stringify(messagePayload, null, 2));
    
    // Tentar salvar mensagem real
    const { data: savedMessage, error: saveError } = await supabase
      .from('messages')
      .insert(messagePayload)
      .select()
      .single();
    
    if (saveError) {
      console.error('❌ [TEST] Erro ao salvar mensagem:', saveError);
    } else {
      console.log('✅ [TEST] Mensagem salva com sucesso:', savedMessage.id);
    }
    
    // 4. Simular resposta
    console.log('🤖 [TEST] Simulando geração de resposta...');
    const responseText = `Olá! Recebi sua mensagem: "${messageText}". Esta é uma resposta automática de teste.`;
    
    console.log('📤 [TEST] Resposta gerada:', responseText);
    
    // Resultado final
    console.log('\n🎉 [TEST] Simulação concluída com sucesso!');
    console.log('📊 [TEST] Resumo:', {
       correlationId,
       deviceId: realDevice.id,
       chatbotId: chatbot.id,
       configStatus: 'found',
       messageId: savedMessage ? savedMessage.id : 'não salva',
       responseGenerated: true
     });
    
  } catch (error) {
    console.error('❌ [TEST] Erro durante simulação:', error);
  }
}

testWebhookLogic();