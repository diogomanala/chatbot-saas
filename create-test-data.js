// Script para criar dados de teste
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestData() {
  console.log('🏗️ Criando dados de teste...');
  
  try {
    // 1. Criar organização de teste (usando apenas colunas que existem)
    console.log('\n📊 Criando organização...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Organização Teste',
        total_credits: 1000
      })
      .select()
      .single();
    
    if (orgError) {
      console.error('❌ Erro ao criar organização:', orgError);
      return;
    }
    
    console.log('✅ Organização criada:', org);

    // 2. Criar chatbot de teste
    console.log('\n🤖 Criando chatbot...');
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .insert({
        name: 'Chatbot Teste',
        org_id: org.id,
        phone_number: '5511999999999'
      })
      .select()
      .single();
    
    if (chatbotError) {
      console.error('❌ Erro ao criar chatbot:', chatbotError);
      return;
    }
    
    console.log('✅ Chatbot criado:', chatbot);

    console.log('\n🎉 Dados de teste criados com sucesso!');
    console.log('📋 Resumo:');
    console.log(`  - Organização: ${org.name} (ID: ${org.id})`);
    console.log(`  - Chatbot: ${chatbot.name} (ID: ${chatbot.id})`);
    console.log(`  - Créditos: ${org.total_credits}`);

  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

createTestData();