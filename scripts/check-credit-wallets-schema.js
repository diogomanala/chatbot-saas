require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCreditWalletsSchema() {
  try {
    console.log('🔍 [VERIFICANDO SCHEMA DA TABELA CREDIT_WALLETS]\n');
    
    // Buscar uma carteira de exemplo para ver a estrutura
    const { data: sampleWallet, error: sampleError } = await supabase
      .from('credit_wallets')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleError) {
      console.log('❌ Erro ao buscar carteira de exemplo:', sampleError);
      
      // Tentar buscar todas as carteiras
      const { data: allWallets, error: allError } = await supabase
        .from('credit_wallets')
        .select('*')
        .limit(5);
      
      if (allError) {
        console.log('❌ Erro ao buscar todas as carteiras:', allError);
        return;
      }
      
      if (allWallets && allWallets.length > 0) {
        console.log('📋 Estrutura baseada em carteiras existentes:');
        Object.keys(allWallets[0]).forEach(key => {
          console.log(`   - ${key}: ${typeof allWallets[0][key]}`);
        });
        
        console.log('\n📊 Carteiras encontradas:');
        allWallets.forEach((wallet, index) => {
          console.log(`   ${index + 1}. Org ID: ${wallet.org_id}`);
          console.log(`      Balance: ${wallet.balance || wallet.credits || 'N/A'}`);
        });
      } else {
        console.log('📋 Nenhuma carteira encontrada');
      }
      
    } else {
      console.log('📋 Estrutura baseada em carteira de exemplo:');
      if (sampleWallet) {
        Object.keys(sampleWallet).forEach(key => {
          console.log(`   - ${key}: ${typeof sampleWallet[key]} = ${sampleWallet[key]}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkCreditWalletsSchema();