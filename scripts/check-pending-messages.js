require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPendingMessages() {
  try {
    console.log('📊 [VERIFICANDO MENSAGENS PENDENTES]\n');
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('billing_status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return;
    }
    
    console.log(`📈 Total de mensagens pendentes: ${data.length}\n`);
    
    data.forEach((msg, i) => {
      console.log(`${i + 1}. 📱 Mensagem ID: ${msg.id}`);
      console.log(`   📞 Telefone: ${msg.phone}`);
      console.log(`   📤 Direção: ${msg.direction}`);
      console.log(`   🔤 Tokens: ${msg.tokens_used}`);
      console.log(`   💰 Custo: ${msg.cost_credits}`);
      console.log(`   📊 Status: ${msg.billing_status}`);
      console.log(`   📅 Criado: ${msg.created_at}`);
      console.log(`   💳 Cobrado: ${msg.billed_at || 'Não cobrado'}`);
      console.log('   ---');
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkPendingMessages();