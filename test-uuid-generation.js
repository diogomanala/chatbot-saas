import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUuidGeneration() {
  console.log('🧪 Testando geração de UUID na tabela messages...');

  // IDs válidos conhecidos
  const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
  const chatbotId = '761a8909-6674-440b-9811-7a232efb8a4b';
  const deviceId = '9d166619-e7cf-4f5e-9637-65c6f4d2481f';

  console.log('📋 Usando IDs válidos conhecidos');

  // Teste 1: Inserção SEM especificar ID (deixar o banco gerar)
  console.log('\n1️⃣ Teste: Inserção SEM especificar ID (auto-geração)...');
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '5511999999999',
        message_content: 'Teste sem ID especificado',
        direction: 'inbound',
        status: 'received',
        external_id: `test-no-id-${Date.now()}`,
        tokens_used: 0,
        billing_status: 'received',
        created_at: new Date().toISOString(),
        metadata: {}
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro na inserção sem ID:', error);
    } else {
      console.log('✅ Sucesso! ID gerado automaticamente:', data.id);
    }
  } catch (err) {
    console.error('💥 Exceção na inserção sem ID:', err);
  }

  // Teste 2: Inserção COM ID UUID válido especificado
  console.log('\n2️⃣ Teste: Inserção COM ID UUID válido especificado...');
  const customUuid = crypto.randomUUID();
  console.log('🔑 UUID customizado:', customUuid);
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        id: customUuid,
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '5511999999999',
        message_content: 'Teste com ID especificado',
        direction: 'outbound',
        status: 'sent',
        external_id: `test-with-id-${Date.now()}`,
        tokens_used: 1,
        billing_status: 'processed',
        created_at: new Date().toISOString(),
        metadata: {}
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro na inserção com ID:', error);
    } else {
      console.log('✅ Sucesso! ID especificado usado:', data.id);
    }
  } catch (err) {
    console.error('💥 Exceção na inserção com ID:', err);
  }

  // Teste 3: Verificar se há triggers ou funções na tabela
  console.log('\n3️⃣ Teste: Verificando estrutura da tabela messages...');
  try {
    const { data, error } = await supabase
      .rpc('sql', {
        query: `
          SELECT column_name, data_type, column_default, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'messages' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });

    if (error) {
      console.error('❌ Erro ao verificar estrutura:', error);
    } else {
      console.log('📊 Estrutura da tabela messages:');
      console.table(data);
    }
  } catch (err) {
    console.error('💥 Exceção ao verificar estrutura:', err);
  }
}

testUuidGeneration().catch(console.error);