require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWalletQuery() {
  console.log('=== TESTE DE CONSULTA NA TABELA CREDIT_WALLETS ===\n');
  
  const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
  console.log(`Testando com org_id: ${orgId}`);
  console.log(`Tipo do org_id: ${typeof orgId}`);
  
  // Teste 1: Buscar todas as carteiras
  console.log('\n1. Buscando todas as carteiras...');
  const { data: allWallets, error: allError } = await supabase
    .from('credit_wallets')
    .select('*');
    
  if (allError) {
    console.error('Erro ao buscar todas as carteiras:', allError);
  } else {
    console.log(`Encontradas ${allWallets.length} carteiras:`);
    allWallets.forEach(wallet => {
      console.log(`- org_id: ${wallet.org_id} (tipo: ${typeof wallet.org_id}), balance: ${wallet.balance}`);
    });
  }
  
  // Teste 2: Buscar carteira específica
  console.log('\n2. Buscando carteira específica...');
  const { data: wallet, error: walletError } = await supabase
    .from('credit_wallets')
    .select('*')
    .eq('org_id', orgId)
    .single();
    
  if (walletError) {
    console.error('Erro ao buscar carteira específica:', walletError);
  } else {
    console.log('Carteira encontrada:', wallet);
  }
  
  // Teste 3: Tentar atualizar
  console.log('\n3. Testando atualização...');
  const { error: updateError } = await supabase
    .from('credit_wallets')
    .update({ balance: 1000 })
    .eq('org_id', orgId);
    
  if (updateError) {
    console.error('Erro ao atualizar carteira:', updateError);
  } else {
    console.log('Atualização bem-sucedida (teste)');
    
    // Reverter a mudança
    await supabase
      .from('credit_wallets')
      .update({ balance: wallet?.balance || 0 })
      .eq('org_id', orgId);
  }
}

testWalletQuery().catch(console.error);