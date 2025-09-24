const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testOutboundOnly() {
  try {
    console.log('🧪 Testando inserção APENAS da mensagem outbound...');
    
    // IDs fixos que sabemos que existem
    const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
    const chatbotId = '761a8909-6674-440b-9811-7a232efb8a4b';
    const deviceId = '9d166619-e7cf-4f5e-9637-65c6f4d2481f';

    console.log('📝 Tentando inserir APENAS mensagem outbound...');
    
    // Teste 1: Inserção básica
    console.log('\n🔍 Teste 1: Inserção básica da mensagem outbound');
    const { data: outboundMessage1, error: outboundError1 } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '5511999999999@c.us',
        message_content: 'Resposta automática de teste',
        direction: 'outbound',
        status: 'sent',
        external_id: `response_test_${Date.now()}`,
        tokens_used: 1,
        billing_status: 'processed',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (outboundError1) {
      console.error('❌ Erro no teste 1:', outboundError1);
    } else {
      console.log('✅ Teste 1 bem-sucedido:', outboundMessage1.id);
    }

    // Teste 2: Inserção com metadata
    console.log('\n🔍 Teste 2: Inserção com metadata');
    const { data: outboundMessage2, error: outboundError2 } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '5511999999999@c.us',
        message_content: 'Resposta com metadata',
        direction: 'outbound',
        status: 'sent',
        external_id: `response_meta_${Date.now()}`,
        tokens_used: 1,
        billing_status: 'processed',
        created_at: new Date().toISOString(),
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (outboundError2) {
      console.error('❌ Erro no teste 2:', outboundError2);
    } else {
      console.log('✅ Teste 2 bem-sucedido:', outboundMessage2.id);
    }

    // Teste 3: Inserção com response_to
    console.log('\n🔍 Teste 3: Inserção com response_to no metadata');
    const { data: outboundMessage3, error: outboundError3 } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '5511999999999@c.us',
        message_content: 'Resposta com response_to',
        direction: 'outbound',
        status: 'sent',
        external_id: `response_to_${Date.now()}`,
        tokens_used: 1,
        billing_status: 'processed',
        created_at: new Date().toISOString(),
        metadata: {
          response_to: '311f6e85-2987-47fd-9926-f224200f3587', // ID de uma mensagem existente
          test: true,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (outboundError3) {
      console.error('❌ Erro no teste 3:', outboundError3);
    } else {
      console.log('✅ Teste 3 bem-sucedido:', outboundMessage3.id);
    }

  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

testOutboundOnly();