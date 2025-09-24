const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase (usando variáveis de ambiente ou valores padrão)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Chave do Supabase não encontrada. Configure SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncWalletTables() {
  try {
    console.log('🔄 Iniciando sincronização das tabelas...');
    
    // Executar a função de sincronização
    const { data, error } = await supabase.rpc('sync_wallet_tables');
    
    if (error) {
      console.error('❌ Erro ao executar sync_wallet_tables:', error);
      return;
    }
    
    console.log('✅ Resultado da sincronização:', data);
    
    // Verificar os saldos atuais
    console.log('\n📊 Verificando saldos atuais...');
    
    const { data: walletData, error: walletError } = await supabase
      .from('credit_wallets')
      .select('org_id, balance')
      .order('org_id');
    
    const { data: orgCreditsData, error: orgCreditsError } = await supabase
      .from('organization_credits')
      .select('org_id, balance')
      .order('org_id');
    
    if (walletError) {
      console.error('❌ Erro ao buscar credit_wallets:', walletError);
    } else {
      console.log('\n💳 Credit Wallets:');
      walletData.forEach(wallet => {
        console.log(`  ${wallet.org_id}: ${wallet.balance} créditos`);
      });
    }
    
    if (orgCreditsError) {
      console.error('❌ Erro ao buscar organization_credits:', orgCreditsError);
    } else {
      console.log('\n🏢 Organization Credits:');
      orgCreditsData.forEach(org => {
        console.log(`  ${org.org_id}: ${org.balance} créditos`);
      });
    }
    
    // Verificar discrepâncias
    if (walletData && orgCreditsData) {
      console.log('\n🔍 Verificando discrepâncias...');
      const discrepancies = [];
      
      // Criar mapas para comparação
      const walletMap = new Map(walletData.map(w => [w.org_id, w.balance]));
      const orgCreditsMap = new Map(orgCreditsData.map(o => [o.org_id, o.balance]));
      
      // Verificar todas as organizações
      const allOrgIds = new Set([...walletMap.keys(), ...orgCreditsMap.keys()]);
      
      allOrgIds.forEach(orgId => {
        const walletBalance = walletMap.get(orgId) || 0;
        const orgCreditsBalance = orgCreditsMap.get(orgId) || 0;
        
        if (walletBalance !== orgCreditsBalance) {
          discrepancies.push({
            org_id: orgId,
            wallet_balance: walletBalance,
            org_credits_balance: orgCreditsBalance,
            difference: walletBalance - orgCreditsBalance
          });
        }
      });
      
      if (discrepancies.length === 0) {
        console.log('✅ Nenhuma discrepância encontrada! Tabelas estão sincronizadas.');
      } else {
        console.log('⚠️ Discrepâncias encontradas:');
        discrepancies.forEach(disc => {
          console.log(`  ${disc.org_id}: Wallet=${disc.wallet_balance}, OrgCredits=${disc.org_credits_balance}, Diff=${disc.difference}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante a sincronização:', error);
  }
}

// Executar a sincronização
syncWalletTables().then(() => {
  console.log('\n🏁 Sincronização concluída.');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});