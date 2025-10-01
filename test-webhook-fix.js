const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://anlemekgocrrllsogxix.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFubGVtZWtnb2Nycmxsc29neGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MDEyMjMsImV4cCI6MjA3MzE3NzIyM30.7K4zVdnDh_3YuBz59PX8WoRwDxKjXJ0KXnD1tNvp7iM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWebhookFix() {
  console.log('🧪 Testando inserção com UUIDs válidos (como no webhook atual)...\n');

  // Usar os mesmos IDs que estão no webhook atual
  const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
  const chatbotId = '761a8909-6674-440b-9811-7a232efb8a4b';
  const deviceId = '9d166619-e7cf-4f5e-9637-65c6f4d2481f';

  console.log('📋 IDs que serão testados:');
  console.log(`  org_id: ${orgId}`);
  console.log(`  chatbot_id: ${chatbotId}`);
  console.log(`  device_id: ${deviceId}`);

  try {
    // Teste 1: Mensagem inbound
    console.log('\n1️⃣ Testando inserção de mensagem inbound...');
    
    const inboundMessage = {
      id: `test-inbound-${Date.now()}`,
      org_id: orgId,
      chatbot_id: chatbotId,
      device_id: deviceId,
      phone_number: '+5511999999999',
      message_content: 'Teste de mensagem inbound',
      direction: 'inbound',
      status: 'received',
      external_id: `ext_${Date.now()}`,
      tokens_used: 0,
      billing_status: 'received',
      created_at: new Date().toISOString(),
      metadata: {
        test: true,
        processed_at: new Date().toISOString()
      }
    };

    const { data: inboundData, error: inboundError } = await supabase
      .from('messages')
      .insert(inboundMessage)
      .select()
      .single();

    if (inboundError) {
      console.log('❌ Erro na inserção inbound:', inboundError);
    } else {
      console.log('✅ Mensagem inbound inserida com sucesso:', inboundData.id);
    }

    // Teste 2: Mensagem outbound
    console.log('\n2️⃣ Testando inserção de mensagem outbound...');
    
    const outboundMessage = {
      id: `test-outbound-${Date.now()}`,
      org_id: orgId,
      chatbot_id: chatbotId,
      device_id: deviceId,
      phone_number: '+5511999999999',
      message_content: 'Teste de mensagem outbound',
      direction: 'outbound',
      status: 'sent',
      external_id: `response_${Date.now()}`,
      tokens_used: 1,
      billing_status: 'processed',
      created_at: new Date().toISOString(),
      metadata: {
        test: true,
        response_to: `ext_${Date.now()}`,
        generated_at: new Date().toISOString()
      }
    };

    const { data: outboundData, error: outboundError } = await supabase
      .from('messages')
      .insert(outboundMessage)
      .select()
      .single();

    if (outboundError) {
      console.log('❌ Erro na inserção outbound:', outboundError);
    } else {
      console.log('✅ Mensagem outbound inserida com sucesso:', outboundData.id);
    }

    // Teste 3: Verificar se os IDs existem nas tabelas referenciadas
    console.log('\n3️⃣ Verificando se os IDs existem nas tabelas referenciadas...');
    
    const { data: orgExists } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();
    
    const { data: chatbotExists } = await supabase
      .from('chatbots')
      .select('id')
      .eq('id', chatbotId)
      .single();
    
    const { data: deviceExists } = await supabase
      .from('devices')
      .select('id')
      .eq('id', deviceId)
      .single();

    console.log(`  Organization ${orgId}: ${orgExists ? '✅ Existe' : '❌ Não existe'}`);
    console.log(`  Chatbot ${chatbotId}: ${chatbotExists ? '✅ Existe' : '❌ Não existe'}`);
    console.log(`  Device ${deviceId}: ${deviceExists ? '✅ Existe' : '❌ Não existe'}`);

    if (!orgExists || !chatbotExists || !deviceExists) {
      console.log('\n⚠️  Alguns IDs não existem nas tabelas referenciadas. Isso pode causar erros de foreign key.');
    } else {
      console.log('\n✅ Todos os IDs existem nas tabelas referenciadas!');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testWebhookFix();