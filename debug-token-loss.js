require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugTokenLoss() {
  console.log('🔍 Investigando perda de tokens no processo de salvamento...\n');
  
  // 1. Verificar mensagens recentes com billing_status 'charged'
  console.log('1️⃣ Verificando mensagens com billing_status = "charged":');
  const { data: chargedMessages } = await supabase
    .from('messages')
    .select('id, direction, billing_status, tokens_used, created_at')
    .eq('billing_status', 'charged')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.table(chargedMessages || []);
  
  // 2. Verificar mensagens recentes com billing_status 'debited' e tokens > 0
  console.log('\n2️⃣ Verificando mensagens com billing_status = "debited" e tokens > 0:');
  const { data: debitedWithTokens } = await supabase
    .from('messages')
    .select('id, direction, billing_status, tokens_used, created_at')
    .eq('billing_status', 'debited')
    .gt('tokens_used', 0)
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.table(debitedWithTokens || []);
  
  // 3. Verificar mensagens recentes com billing_status 'debited' e tokens = 0
  console.log('\n3️⃣ Verificando mensagens com billing_status = "debited" e tokens = 0:');
  const { data: debitedZeroTokens } = await supabase
    .from('messages')
    .select('id, direction, billing_status, tokens_used, created_at, metadata')
    .eq('billing_status', 'debited')
    .eq('tokens_used', 0)
    .order('created_at', { ascending: false })
    .limit(3);
    
  console.table(debitedZeroTokens || []);
  
  // 4. Verificar se há algum padrão nos metadados
  if (debitedZeroTokens && debitedZeroTokens.length > 0) {
    console.log('\n4️⃣ Analisando metadados das mensagens com tokens = 0:');
    debitedZeroTokens.forEach((msg, index) => {
      console.log(`Mensagem ${index + 1}:`, {
        id: msg.id,
        metadata: msg.metadata,
        created_at: msg.created_at
      });
    });
  }
  
  // 5. Estatísticas gerais
  console.log('\n5️⃣ Estatísticas gerais:');
  const { data: stats } = await supabase
    .from('messages')
    .select('billing_status, direction, tokens_used')
    .eq('direction', 'outbound');
    
  if (stats) {
    const summary = stats.reduce((acc, msg) => {
      const key = `${msg.billing_status}_${msg.tokens_used > 0 ? 'with_tokens' : 'zero_tokens'}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    
    console.table(summary);
  }
}

debugTokenLoss().catch(console.error);