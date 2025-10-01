// Script para verificar esquema real das tabelas
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Verificando esquema das tabelas...');
  
  try {
    // Verificar estrutura da tabela organizations
    console.log('\n📊 Estrutura da tabela organizations:');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);
    
    if (orgError) {
      console.error('❌ Erro:', orgError);
    } else {
      console.log('✅ Colunas disponíveis:', Object.keys(orgs[0] || {}));
      if (orgs[0]) console.log('Exemplo:', orgs[0]);
    }

    // Verificar estrutura da tabela chatbots
    console.log('\n🤖 Estrutura da tabela chatbots:');
    const { data: bots, error: botError } = await supabase
      .from('chatbots')
      .select('*')
      .limit(1);
    
    if (botError) {
      console.error('❌ Erro:', botError);
    } else {
      console.log('✅ Colunas disponíveis:', Object.keys(bots[0] || {}));
      if (bots[0]) console.log('Exemplo:', bots[0]);
    }

    // Verificar estrutura da tabela messages
    console.log('\n💬 Estrutura da tabela messages:');
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (msgError) {
      console.error('❌ Erro:', msgError);
    } else {
      console.log('✅ Colunas disponíveis:', Object.keys(messages[0] || {}));
      if (messages[0]) console.log('Exemplo:', messages[0]);
    }

  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

checkSchema();