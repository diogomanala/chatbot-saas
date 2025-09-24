require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCompleteFlow() {
  console.log('🧪 Iniciando teste do fluxo completo de processamento de mensagens\n');

  try {
    // 1. Verificar mensagens recentes
    console.log('📊 1. Analisando mensagens recentes...');
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      return;
    }

    console.log(`   Total de mensagens analisadas: ${messages.length}`);

    // Estatísticas por direção
    const inboundMessages = messages.filter(m => m.direction === 'inbound');
    const outboundMessages = messages.filter(m => m.direction === 'outbound');
    
    console.log(`   📥 Mensagens inbound: ${inboundMessages.length}`);
    console.log(`   📤 Mensagens outbound: ${outboundMessages.length}`);

    // 2. Verificar billing_status das mensagens inbound
    console.log('\n📥 2. Verificando mensagens inbound...');
    const inboundWithoutSkipped = inboundMessages.filter(m => m.billing_status !== 'skipped');
    const inboundWithNull = inboundMessages.filter(m => m.billing_status === null);
    
    console.log(`   ✅ Mensagens inbound com billing_status = 'skipped': ${inboundMessages.filter(m => m.billing_status === 'skipped').length}`);
    console.log(`   ⚠️  Mensagens inbound sem 'skipped': ${inboundWithoutSkipped.length}`);
    console.log(`   ❌ Mensagens inbound com billing_status = null: ${inboundWithNull.length}`);

    if (inboundWithoutSkipped.length > 0) {
      console.log('   🔍 Mensagens inbound problemáticas:');
      inboundWithoutSkipped.forEach(m => {
        console.log(`      - ID: ${m.id}, Status: ${m.billing_status}, Criada: ${m.created_at}`);
      });
    }

    // 3. Verificar billing_status das mensagens outbound
    console.log('\n📤 3. Verificando mensagens outbound...');
    const outboundWithStatus = outboundMessages.filter(m => m.billing_status !== null);
    const outboundWithoutStatus = outboundMessages.filter(m => m.billing_status === null);
    
    console.log(`   ✅ Mensagens outbound com billing_status definido: ${outboundWithStatus.length}`);
    console.log(`   ❌ Mensagens outbound sem billing_status: ${outboundWithoutStatus.length}`);

    // Estatísticas de billing_status para outbound
    const statusCounts = {};
    outboundMessages.forEach(m => {
      const status = m.billing_status || 'null';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('   📊 Distribuição de billing_status (outbound):');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`      - ${status}: ${count}`);
    });

    // 4. Verificar tokens e custos
    console.log('\n💰 4. Verificando tokens e custos...');
    const messagesWithTokens = outboundMessages.filter(m => m.tokens_used && m.tokens_used > 0);
    const messagesWithCosts = outboundMessages.filter(m => m.cost_credits && m.cost_credits > 0);
    
    console.log(`   🔢 Mensagens outbound com tokens_used: ${messagesWithTokens.length}`);
    console.log(`   💳 Mensagens outbound com cost_credits: ${messagesWithCosts.length}`);

    if (messagesWithTokens.length > 0) {
      const totalTokens = messagesWithTokens.reduce((sum, m) => sum + (m.tokens_used || 0), 0);
      const avgTokens = totalTokens / messagesWithTokens.length;
      console.log(`   📈 Total de tokens: ${totalTokens}, Média: ${avgTokens.toFixed(2)}`);
    }

    if (messagesWithCosts.length > 0) {
      const totalCosts = messagesWithCosts.reduce((sum, m) => sum + (m.cost_credits || 0), 0);
      console.log(`   💰 Total de créditos cobrados: ${totalCosts}`);
    }

    // 5. Verificar organizações e carteiras
    console.log('\n🏢 5. Verificando organizações e carteiras...');
    const orgIds = [...new Set(messages.map(m => m.org_id).filter(Boolean))];
    console.log(`   📋 Organizações encontradas: ${orgIds.length}`);

    for (const orgId of orgIds.slice(0, 3)) { // Limitar a 3 para não sobrecarregar
      const { data: wallet, error: walletError } = await supabase
        .from('credit_wallets')
        .select('balance')
        .eq('org_id', orgId)
        .single();

      if (walletError) {
        console.log(`   ❌ Erro ao buscar carteira para org ${orgId}: ${walletError.message}`);
      } else {
        console.log(`   💳 Org ${orgId}: Saldo = ${wallet.balance} créditos`);
      }
    }

    // 6. Verificar integridade dos dados
    console.log('\n🔍 6. Verificando integridade dos dados...');
    
    // Mensagens outbound que deveriam ter sido cobradas mas não foram
    const shouldBeCharged = outboundMessages.filter(m => 
      m.billing_status === 'pending' && 
      m.created_at < new Date(Date.now() - 5 * 60 * 1000).toISOString() // Mais de 5 minutos atrás
    );
    
    console.log(`   ⏰ Mensagens outbound pendentes há mais de 5 min: ${shouldBeCharged.length}`);

    // Mensagens com billing_status = 'charged' mas sem cost_credits
    const chargedWithoutCost = outboundMessages.filter(m => 
      m.billing_status === 'charged' && (!m.cost_credits || m.cost_credits === 0)
    );
    
    console.log(`   ⚠️  Mensagens 'charged' sem cost_credits: ${chargedWithoutCost.length}`);

    // Mensagens com cost_credits mas billing_status != 'charged'
    const costWithoutCharged = outboundMessages.filter(m => 
      m.cost_credits && m.cost_credits > 0 && m.billing_status !== 'charged'
    );
    
    console.log(`   ⚠️  Mensagens com custo mas não 'charged': ${costWithoutCharged.length}`);

    // 7. Resumo final
    console.log('\n📋 7. RESUMO FINAL:');
    console.log('=====================================');
    
    const inboundOk = inboundMessages.length > 0 && inboundWithoutSkipped.length === 0;
    const outboundOk = outboundMessages.length > 0 && outboundWithoutStatus.length === 0;
    const integrityOk = chargedWithoutCost.length === 0 && costWithoutCharged.length === 0;
    
    console.log(`✅ Mensagens inbound: ${inboundOk ? 'OK' : 'PROBLEMAS ENCONTRADOS'}`);
    console.log(`✅ Mensagens outbound: ${outboundOk ? 'OK' : 'PROBLEMAS ENCONTRADOS'}`);
    console.log(`✅ Integridade dos dados: ${integrityOk ? 'OK' : 'PROBLEMAS ENCONTRADOS'}`);
    
    const overallStatus = inboundOk && outboundOk && integrityOk;
    console.log(`\n🎯 STATUS GERAL: ${overallStatus ? '✅ SISTEMA OK' : '❌ REQUER ATENÇÃO'}`);

    if (!overallStatus) {
      console.log('\n🔧 AÇÕES RECOMENDADAS:');
      if (!inboundOk) {
        console.log('   - Verificar webhook para garantir billing_status = "skipped" em mensagens inbound');
      }
      if (!outboundOk) {
        console.log('   - Verificar webhook para garantir billing_status em mensagens outbound');
      }
      if (!integrityOk) {
        console.log('   - Executar script de correção para alinhar billing_status com cost_credits');
      }
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar o teste
testCompleteFlow().then(() => {
  console.log('\n🏁 Teste completo finalizado');
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});