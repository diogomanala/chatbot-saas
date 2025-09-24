require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addCredits() {
  try {
    const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa'; // TitecWeb Admin
    const creditsToAdd = 100;
    
    console.log('💰 [ADICIONANDO CRÉDITOS]\n');
    
    // Verificar se a carteira existe
    const { data: existingWallet } = await supabase
      .from('credit_wallets')
      .select('*')
      .eq('org_id', orgId)
      .single();
    
    if (existingWallet) {
      // Atualizar carteira existente
      const newBalance = (existingWallet.balance || 0) + creditsToAdd;
      
      const { error: updateError } = await supabase
        .from('credit_wallets')
        .update({ 
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId);
      
      if (updateError) {
        console.log('❌ Erro ao atualizar carteira:', updateError);
        return;
      }
      
      console.log(`✅ Carteira atualizada!`);
      console.log(`   Saldo anterior: ${existingWallet.balance || 0} créditos`);
      console.log(`   Créditos adicionados: ${creditsToAdd}`);
      console.log(`   Novo saldo: ${newBalance} créditos`);
      
    } else {
      // Criar nova carteira
      const { error: insertError } = await supabase
        .from('credit_wallets')
        .insert({
          org_id: orgId,
          balance: creditsToAdd,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.log('❌ Erro ao criar carteira:', insertError);
        return;
      }
      
      console.log(`✅ Nova carteira criada!`);
      console.log(`   Saldo inicial: ${creditsToAdd} créditos`);
    }
    
    // Registrar transação de crédito
    await supabase
      .from('transactions')
      .insert({
        org_id: orgId,
        type: 'credit',
        amount: creditsToAdd,
        description: 'Créditos adicionados para teste',
        metadata: {
          added_by: 'test_script',
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      });
    
    console.log(`\n📝 Transação de crédito registrada`);
    console.log(`🎉 Processo concluído!`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

addCredits();