const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSimpleInsert() {
  try {
    console.log('🧪 Testando inserção simples na tabela messages...');
    
    // IDs fixos que sabemos que existem
    const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
    const chatbotId = '761a8909-6674-440b-9811-7a232efb8a4b';
    const deviceId = '9d166619-e7cf-4f5e-9637-65c6f4d2481f';

    console.log('📝 Tentando inserir mensagem inbound...');
    
    const { data: inboundMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '5511999999999@c.us',
        message_content: 'Teste de inserção simples',
        direction: 'inbound',
        status: 'received',
        external_id: `test_${Date.now()}`,
        tokens_used: 0,
        billing_status: 'received',
        created_at: new Date().toISOString(),
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Erro ao inserir mensagem inbound:', messageError);
      console.error('📋 Detalhes do erro:', JSON.stringify(messageError, null, 2));
      return;
    }

    console.log('✅ Mensagem inbound inserida com sucesso:', inboundMessage.id);

    console.log('📝 Tentando inserir mensagem outbound...');
    
    const { data: outboundMessage, error: outboundError } = await supabase
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
        created_at: new Date().toISOString(),
        metadata: {
          response_to: inboundMessage.id,
          test: true,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (outboundError) {
      console.error('❌ Erro ao inserir mensagem outbound:', outboundError);
      console.error('📋 Detalhes do erro:', JSON.stringify(outboundError, null, 2));
      return;
    }

    console.log('✅ Mensagem outbound inserida com sucesso:', outboundMessage.id);
    console.log('🎉 Teste de inserção concluído com sucesso!');

  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

testSimpleInsert();