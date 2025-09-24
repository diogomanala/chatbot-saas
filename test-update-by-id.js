require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpdateById() {
  console.log('=== TESTANDO ATUALIZAÇÃO POR ID ===\n');
  
  const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
  
  // Primeiro, buscar a carteira
  console.log('1. Buscando carteira...');
  const { data: wallet, error: walletError } = await supabase
    .from('credit_wallets')
    .select('id, balance')
    .eq('org_id', orgId)
    .single();
    
  if (walletError) {
    console.error('Erro ao buscar carteira:', walletError);
    return;
  }
  
  console.log('Carteira encontrada:', wallet);
  console.log(`ID da carteira: ${wallet.id} (tipo: ${typeof wallet.id})`);
  
  // Testar atualização usando o ID
  console.log('\n2. Testando atualização por ID...');
  const originalBalance = wallet.balance;
  const newBalance = originalBalance + 0.01;
  
  const { error: updateError } = await supabase
    .from('credit_wallets')
    .update({ 
      balance: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq('id', wallet.id);
    
  if (updateError) {
    console.error('Erro na atualização por ID:', updateError);
  } else {
    console.log('✅ Atualização por ID bem-sucedida');
    
    // Verificar se a atualização funcionou
    const { data: updatedWallet } = await supabase
      .from('credit_wallets')
      .select('balance')
      .eq('id', wallet.id)
      .single();
      
    console.log(`Saldo anterior: ${originalBalance}`);
    console.log(`Saldo atual: ${updatedWallet?.balance}`);
    
    // Reverter para o valor original
    await supabase
      .from('credit_wallets')
      .update({ balance: originalBalance })
      .eq('id', wallet.id);
      
    console.log('Saldo revertido para o valor original');
  }
}

testUpdateById().catch(console.error);