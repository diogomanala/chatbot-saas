const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAutoDebit() {
  try {
    console.log('🔍 Verificando mensagens pendentes...');
    
    // 1. Buscar mensagens outbound pendentes
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, message_content, tokens_used, direction, org_id, billing_status, created_at, cost_credits')
      .eq('direction', 'outbound')
      .or('billing_status.is.null,billing_status.eq.pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return;
    }

    console.log(`📊 Encontradas ${messages?.length || 0} mensagens pendentes:`);
    
    if (messages && messages.length > 0) {
      messages.forEach((msg, index) => {
        console.log(`\n${index + 1}. Message ID: ${msg.id}`);
        console.log(`   Org ID: ${msg.org_id}`);
        console.log(`   Content: ${(msg.message_content || '').substring(0, 50)}...`);
        console.log(`   Tokens Used: ${msg.tokens_used || 0}`);
        console.log(`   Billing Status: ${msg.billing_status || 'null'}`);
        console.log(`   Cost Credits: ${msg.cost_credits || 0}`);
        console.log(`   Created: ${msg.created_at}`);
      });

      // 2. Verificar saldo da organização
      const orgId = messages[0].org_id;
      console.log(`\n💰 Verificando saldo da organização ${orgId}...`);
      
      const { data: credits, error: creditsError } = await supabase
        .from('organization_credits')
        .select('balance')
        .eq('org_id', orgId)
        .single();

      if (creditsError) {
        console.error('❌ Erro ao buscar saldo:', creditsError);
      } else {
        console.log(`💳 Saldo atual: ${credits?.balance || 0} créditos`);
      }

      // 3. Simular processamento de uma mensagem
      const testMessage = messages[0];
      console.log(`\n🧪 Simulando processamento da mensagem ${testMessage.id}...`);
      
      // Calcular tokens (mesma lógica do AutoDebitService)
      const messageContent = testMessage.message_content || '';
      const tokensUsed = testMessage.tokens_used;
      const calculatedTokens = tokensUsed && tokensUsed > 0 ? tokensUsed : Math.ceil(messageContent.length / 4);
      const creditsToDebit = Math.ceil(calculatedTokens / 1000);
      
      console.log(`📏 Cálculos:`);
      console.log(`   Conteúdo: ${messageContent.length} caracteres`);
      console.log(`   Tokens calculados: ${calculatedTokens}`);
      console.log(`   Créditos necessários: ${creditsToDebit}`);
      console.log(`   Saldo disponível: ${credits?.balance || 0}`);
      console.log(`   Suficiente? ${(credits?.balance || 0) >= creditsToDebit ? '✅ Sim' : '❌ Não'}`);

    } else {
      console.log('✅ Nenhuma mensagem pendente encontrada');
    }

    // 4. Verificar últimas transações
    console.log('\n📋 Últimas transações de créditos:');
    const { data: transactions, error: transError } = await supabase
      .from('usage_ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (transError) {
      console.error('❌ Erro ao buscar transações:', transError);
    } else if (transactions && transactions.length > 0) {
      transactions.forEach((trans, index) => {
        console.log(`\n${index + 1}. ${trans.created_at}`);
        console.log(`   Org: ${trans.org_id}`);
        console.log(`   Tipo: ${trans.transaction_type}`);
        console.log(`   Créditos: ${trans.credits}`);
        console.log(`   Descrição: ${trans.description}`);
      });
    } else {
      console.log('   Nenhuma transação encontrada');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testAutoDebit();