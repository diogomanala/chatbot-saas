require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDebitedZeroTokens() {
  console.log('🔍 Verificando mensagens com billing_status = "debited" mas tokens_used = 0...');
  
  const { data, error } = await supabase
    .from('messages')
    .select('id, direction, billing_status, tokens_used, created_at')
    .eq('billing_status', 'debited')
    .eq('tokens_used', 0)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('❌ Erro:', error);
    return;
  }
  
  console.log('📊 Mensagens com billing_status="debited" e tokens_used=0:');
  console.table(data);
  console.log(`Total encontradas: ${data.length}`);
  
  // Verificar também o total geral
  const { count, error: countError } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('billing_status', 'debited')
    .eq('tokens_used', 0);
    
  if (!countError) {
    console.log(`\n📈 Total geral de mensagens com billing_status="debited" e tokens_used=0: ${count}`);
  }
}

checkDebitedZeroTokens().catch(console.error);