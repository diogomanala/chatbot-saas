require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWalletExists() {
  console.log('=== VERIFICANDO EXISTÊNCIA DE CARTEIRA ===\n');
  
  const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
  console.log(`Verificando carteira para org_id: ${orgId}`);
  
  // Buscar todas as carteiras
  const { data: allWallets, error: allError } = await supabase
    .from('credit_wallets')
    .select('*');
    
  if (allError) {
    console.error('Erro ao buscar todas as carteiras:', allError);
    return;
  }
  
  console.log(`\nTotal de carteiras encontradas: ${allWallets.length}`);
  allWallets.forEach(wallet => {
    console.log(`- org_id: ${wallet.org_id}, balance: ${wallet.balance}`);
  });
  
  // Verificar se existe carteira para a organização específica
  const walletExists = allWallets.find(w => w.org_id === orgId);
  
  if (walletExists) {
    console.log(`\n✅ Carteira encontrada para ${orgId}:`, walletExists);
  } else {
    console.log(`\n❌ Nenhuma carteira encontrada para ${orgId}`);
    console.log('\nCriando carteira para a organização...');
    
    const { data: newWallet, error: createError } = await supabase
      .from('credit_wallets')
      .insert({
        org_id: orgId,
        balance: 1000,
        currency: 'BRL'
      })
      .select()
      .single();
      
    if (createError) {
      console.error('Erro ao criar carteira:', createError);
    } else {
      console.log('✅ Carteira criada com sucesso:', newWallet);
    }
  }
}

checkWalletExists().catch(console.error);