require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFilterMethod() {
  console.log('=== TESTANDO MÉTODO FILTER ===\n');
  
  const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
  console.log(`Testando com org_id: ${orgId}`);
  
  // Teste 1: Usando filter
  console.log('\n1. Testando com filter...');
  const { data: wallet1, error: error1 } = await supabase
    .from('credit_wallets')
    .select('*')
    .filter('org_id', 'eq', orgId)
    .single();
    
  if (error1) {
    console.error('Erro com filter:', error1);
  } else {
    console.log('✅ Sucesso com filter:', wallet1);
  }
  
  // Teste 2: Usando eq sem cast
  console.log('\n2. Testando com eq sem cast...');
  const { data: wallet2, error: error2 } = await supabase
    .from('credit_wallets')
    .select('*')
    .eq('org_id', orgId)
    .single();
    
  if (error2) {
    console.error('Erro com eq sem cast:', error2);
  } else {
    console.log('✅ Sucesso com eq sem cast:', wallet2);
  }
  
  // Teste 3: Testando atualização com filter
  console.log('\n3. Testando atualização com filter...');
  const originalBalance = wallet1?.balance || wallet2?.balance || 0;
  
  const { error: updateError } = await supabase
    .from('credit_wallets')
    .update({ balance: originalBalance + 0.01 })
    .filter('org_id', 'eq', orgId);
    
  if (updateError) {
    console.error('Erro na atualização com filter:', updateError);
  } else {
    console.log('✅ Atualização com filter bem-sucedida');
    
    // Reverter
    await supabase
      .from('credit_wallets')
      .update({ balance: originalBalance })
      .filter('org_id', 'eq', orgId);
      
    console.log('Saldo revertido para o valor original');
  }
}

testFilterMethod().catch(console.error);