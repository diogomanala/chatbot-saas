const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMinimalInsert() {
  console.log('🔍 Testando inserção mínima para identificar o problema...\n');

  // IDs fixos para teste
  const orgId = '761a8909-6674-440b-9811-7a232efb8a4b';
  const chatbotId = '8b2c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e';
  const deviceId = '9c3d5e7f-8a1b-2c3d-4e5f-6a7b8c9d0e1f';

  try {
    console.log('📝 Teste 1: Inserção com campos obrigatórios apenas');
    const { data: test1, error: error1 } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '5511999999999',
        message_content: 'Teste mínimo',
        direction: 'inbound'
      })
      .select();

    if (error1) {
      console.error('❌ Erro no teste 1:', error1);
    } else {
      console.log('✅ Teste 1 bem-sucedido:', test1[0]?.id);
    }

    console.log('\n📝 Teste 2: Inserção outbound com campos obrigatórios');
    const { data: test2, error: error2 } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '5511999999999',
        message_content: 'Resposta teste',
        direction: 'outbound'
      })
      .select();

    if (error2) {
      console.error('❌ Erro no teste 2:', error2);
    } else {
      console.log('✅ Teste 2 bem-sucedido:', test2[0]?.id);
    }

    console.log('\n📝 Teste 3: Inserção outbound com response_to');
    const { data: test3, error: error3 } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '5511999999999',
        message_content: 'Resposta com response_to',
        direction: 'outbound',
        metadata: {
          response_to: test1?.[0]?.id || 'test-id'
        }
      })
      .select();

    if (error3) {
      console.error('❌ Erro no teste 3:', error3);
    } else {
      console.log('✅ Teste 3 bem-sucedido:', test3[0]?.id);
    }

    console.log('\n📝 Teste 4: Verificar se o problema é com UUIDs específicos');
    const { data: test4, error: error4 } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '5511888888888',
        message_content: 'Teste com UUIDs diferentes',
        direction: 'outbound',
        external_id: 'test-external-id-' + Date.now()
      })
      .select();

    if (error4) {
      console.error('❌ Erro no teste 4:', error4);
    } else {
      console.log('✅ Teste 4 bem-sucedido:', test4[0]?.id);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testMinimalInsert();