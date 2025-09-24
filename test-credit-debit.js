const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

async function testCreditDebit() {
  try {
    const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa'; // TitecWeb Admin
    
    console.log('🔍 Verificando saldo atual da carteira...');
    
    // Verificar saldo atual
    const { data: wallet, error: walletError } = await supabase
      .from('credit_wallets')
      .select('*')
      .eq('org_id', orgId)
      .single();
    
    if (walletError) {
      console.error('❌ Erro ao buscar carteira:', walletError);
      return;
    }
    
    console.log('💰 Saldo atual:', wallet.balance, wallet.currency);
    
    // Simular débito de créditos por uma mensagem
    const debitAmount = 0.05; // 5 centavos por mensagem
    const messageDescription = 'Débito por mensagem WhatsApp enviada';
    
    console.log(`\n💸 Testando débito de ${debitAmount} ${wallet.currency}...`);
    
    // Verificar se há saldo suficiente
    if (wallet.balance < debitAmount) {
      console.log('⚠️ Saldo insuficiente para realizar o débito!');
      return;
    }
    
    // Realizar o débito
    const newBalance = parseFloat(wallet.balance) - debitAmount;
    
    const { data: updatedWallet, error: updateError } = await supabase
      .from('credit_wallets')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('org_id', orgId)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Erro ao debitar créditos:', updateError);
      return;
    }
    
    console.log('✅ Débito realizado com sucesso!');
    console.log('💰 Novo saldo:', updatedWallet.balance, updatedWallet.currency);
    
    // Registrar a transação no ledger de uso
    const { data: ledgerEntry, error: ledgerError } = await supabase
      .from('usage_ledger')
      .insert({
        org_id: orgId,
        usage_type: 'outbound',
        amount: debitAmount,
        description: messageDescription,
        metadata: {
          message_type: 'whatsapp',
          cost_per_message: debitAmount,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (ledgerError) {
      console.error('⚠️ Erro ao registrar no ledger:', ledgerError);
    } else {
      console.log('📝 Transação registrada no ledger:', ledgerEntry.id);
    }
    
    // Verificar se o saldo está baixo (menos de 10 reais)
    if (updatedWallet.balance < 10.00) {
      console.log('\n⚠️ ALERTA: Saldo baixo! Considere recarregar a carteira.');
      
      // Criar alerta de saldo baixo
      const { data: alert, error: alertError } = await supabase
        .from('credit_alerts')
        .upsert({
          org_id: orgId,
          alert_type: 'low_balance',
          threshold: 10.00,
          current_balance: updatedWallet.balance,
          message: `Saldo baixo: R$ ${updatedWallet.balance.toFixed(2)}. Recarregue sua carteira para continuar usando o serviço.`,
          is_active: true
        }, {
          onConflict: 'org_id,alert_type,is_active'
        })
        .select()
        .single();
      
      if (!alertError) {
        console.log('🚨 Alerta de saldo baixo criado:', alert.id);
      }
    }
    
    console.log('\n✅ Teste de débito de créditos concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  }
}

// Executar o teste
testCreditDebit()
  .then(() => {
    console.log('\n🎉 Processo de teste concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Falha no teste:', error);
    process.exit(1);
  });