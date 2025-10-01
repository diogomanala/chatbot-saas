const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://anlemekgocrrllsogxix.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_PR3yVUXsopPYTE87R1L3eA_62IHitGT';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSyncFunction() {
  try {
    console.log('🔧 Criando função de sincronização...');
    
    // SQL para criar a função de sincronização
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION sync_wallet_tables()
      RETURNS TEXT AS $$
      DECLARE
        sync_count INTEGER := 0;
        org_record RECORD;
      BEGIN
        -- Sincronizar dados de credit_wallets para organization_credits
        FOR org_record IN 
          SELECT cw.org_id, cw.balance 
          FROM credit_wallets cw
        LOOP
          -- Inserir ou atualizar em organization_credits
          INSERT INTO organization_credits (org_id, balance, updated_at)
          VALUES (org_record.org_id, org_record.balance, NOW())
          ON CONFLICT (org_id) 
          DO UPDATE SET 
            balance = EXCLUDED.balance,
            updated_at = EXCLUDED.updated_at;
          
          sync_count := sync_count + 1;
        END LOOP;
        
        -- Sincronizar dados de organization_credits para credit_wallets (caso existam apenas em organization_credits)
        FOR org_record IN 
          SELECT oc.org_id, oc.balance 
          FROM organization_credits oc
          WHERE NOT EXISTS (SELECT 1 FROM credit_wallets cw WHERE cw.org_id = oc.org_id)
        LOOP
          -- Inserir em credit_wallets
          INSERT INTO credit_wallets (org_id, balance, updated_at)
          VALUES (org_record.org_id, org_record.balance, NOW());
          
          sync_count := sync_count + 1;
        END LOOP;
        
        RETURN 'Sincronização concluída. ' || sync_count || ' registros processados.';
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    const { data, error } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });
    
    if (error) {
      console.log('⚠️ Tentando criar função usando query direta...');
      
      // Tentar executar diretamente
      const { data: directData, error: directError } = await supabase
        .from('_sql')
        .select('*')
        .eq('query', createFunctionSQL);
      
      if (directError) {
        console.error('❌ Erro ao criar função:', directError);
        
        // Vamos fazer a sincronização manualmente
        console.log('🔄 Executando sincronização manual...');
        await manualSync();
        return;
      }
    }
    
    console.log('✅ Função criada com sucesso!');
    
    // Executar a função
    console.log('🔄 Executando sincronização...');
    const { data: syncData, error: syncError } = await supabase.rpc('sync_wallet_tables');
    
    if (syncError) {
      console.error('❌ Erro ao executar sincronização:', syncError);
      await manualSync();
    } else {
      console.log('✅ Resultado:', syncData);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
    await manualSync();
  }
}

async function manualSync() {
  try {
    console.log('🔄 Iniciando sincronização manual...');
    
    // Buscar dados de credit_wallets
    const { data: walletData, error: walletError } = await supabase
      .from('credit_wallets')
      .select('org_id, balance');
    
    if (walletError) {
      console.error('❌ Erro ao buscar credit_wallets:', walletError);
      return;
    }
    
    console.log(`📊 Encontrados ${walletData.length} registros em credit_wallets`);
    
    // Para cada registro em credit_wallets, sincronizar com organization_credits
    for (const wallet of walletData) {
      const { data, error } = await supabase
        .from('organization_credits')
        .upsert({
          org_id: wallet.org_id,
          balance: wallet.balance,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'org_id'
        });
      
      if (error) {
        console.error(`❌ Erro ao sincronizar ${wallet.org_id}:`, error);
      } else {
        console.log(`✅ Sincronizado ${wallet.org_id}: ${wallet.balance} créditos`);
      }
    }
    
    // Verificar se há registros apenas em organization_credits
    const { data: orgCreditsData, error: orgCreditsError } = await supabase
      .from('organization_credits')
      .select('org_id, balance');
    
    if (!orgCreditsError && orgCreditsData) {
      const walletOrgIds = new Set(walletData.map(w => w.org_id));
      const onlyInOrgCredits = orgCreditsData.filter(oc => !walletOrgIds.has(oc.org_id));
      
      for (const orgCredit of onlyInOrgCredits) {
        const { data, error } = await supabase
          .from('credit_wallets')
          .insert({
            org_id: orgCredit.org_id,
            balance: orgCredit.balance,
            updated_at: new Date().toISOString()
          });
        
        if (error) {
          console.error(`❌ Erro ao criar wallet para ${orgCredit.org_id}:`, error);
        } else {
          console.log(`✅ Criado wallet para ${orgCredit.org_id}: ${orgCredit.balance} créditos`);
        }
      }
    }
    
    console.log('✅ Sincronização manual concluída!');
    
  } catch (error) {
    console.error('❌ Erro na sincronização manual:', error);
  }
}

async function checkBalances() {
  try {
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
      
      const walletMap = new Map(walletData.map(w => [w.org_id, w.balance]));
      const orgCreditsMap = new Map(orgCreditsData.map(o => [o.org_id, o.balance]));
      
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
    console.error('❌ Erro ao verificar saldos:', error);
  }
}

// Executar
createSyncFunction().then(async () => {
  await checkBalances();
  console.log('\n🏁 Processo concluído.');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});