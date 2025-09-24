const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/"/g, '');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ [TEST] Variáveis de ambiente do Supabase não encontradas');
  console.log('SUPABASE_URL:', supabaseUrl);
  console.log('SUPABASE_KEY:', supabaseKey ? 'definida' : 'não definida');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ [TEST] Cliente Supabase configurado com sucesso');

async function testRealWebhook() {
  try {
    console.log('🚀 [TEST] Iniciando teste do webhook real...');
    
    // 1. Buscar chatbot default
    console.log('🤖 [TEST] Buscando chatbot default...');
    const { data: chatbots, error: chatbotError } = await supabase
      .from('chatbots')
      .select('*')
      .eq('is_default', true)
      .limit(1);
    
    if (chatbotError || !chatbots || chatbots.length === 0) {
      console.error('❌ [TEST] Nenhum chatbot default encontrado:', chatbotError);
      return;
    }
    
    const chatbot = chatbots[0];
    console.log('✅ [TEST] Chatbot default encontrado:', chatbot.name);
    
    // 2. Buscar device real existente
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
    
    const device = existingDevices[0];
    console.log('✅ [TEST] Device real encontrado:', {
      id: device.id,
      name: device.name,
      session_name: device.session_name
    });
    
    // 3. Criar payload do webhook Evolution API
    const correlationId = `webhook_test_${Date.now()}`;
    const phoneNumber = '5522997603813';
    const messageText = 'Teste do webhook real - Evolution API';
    
    const webhookPayload = {
      event: 'messages.upsert',
      instance: device.session_name,
      data: {
        key: {
          id: correlationId,
          remoteJid: `${phoneNumber}@s.whatsapp.net`,
          fromMe: false
        },
        message: {
          messageType: 'text',
          text: messageText
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        instanceName: device.session_name,
        source: 'evolution-api'
      }
    };
    
    console.log('📋 [TEST] Payload do webhook:', JSON.stringify(webhookPayload, null, 2));
    
    // 4. Fazer requisição HTTP para o webhook
    console.log('🌐 [TEST] Enviando requisição para o webhook...');
    
    const webhookUrl = 'http://localhost:3000/api/webhook/evolution/messages-upsert';
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Evolution-API/1.0'
      },
      body: JSON.stringify(webhookPayload)
    });
    
    const responseText = await response.text();
    
    console.log('📊 [TEST] Resposta do webhook:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText
    });
    
    if (response.ok) {
      console.log('✅ [TEST] Webhook processado com sucesso!');
      
      // 5. Verificar se a mensagem foi salva
      console.log('🔍 [TEST] Verificando se a mensagem foi salva...');
      
      // Aguardar um pouco para o processamento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { data: savedMessages, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('external_id', correlationId)
        .limit(1);
      
      if (messageError) {
        console.error('❌ [TEST] Erro ao buscar mensagem salva:', messageError);
      } else if (savedMessages && savedMessages.length > 0) {
        console.log('✅ [TEST] Mensagem encontrada no banco:', {
          id: savedMessages[0].id,
          content: savedMessages[0].message_content,
          direction: savedMessages[0].direction,
          status: savedMessages[0].status,
          created_at: savedMessages[0].created_at
        });
      } else {
        console.log('⚠️ [TEST] Mensagem não encontrada no banco (pode estar sendo processada)');
      }
      
    } else {
      console.error('❌ [TEST] Webhook falhou:', {
        status: response.status,
        body: responseText
      });
    }
    
    console.log('\n🎉 [TEST] Teste do webhook real concluído!');
    
  } catch (error) {
    console.error('💥 [TEST] Erro durante o teste:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Executar o teste
testRealWebhook();