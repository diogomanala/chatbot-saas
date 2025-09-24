const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testBillingFix() {
  console.log('🧪 [TEST] Testando correção de cobrança dupla...\n');
  
  try {
    // 1. Verificar mensagens recentes ANTES do teste
    console.log('📊 [BEFORE] Verificando mensagens recentes antes do teste:');
    const { data: messagesBefore, error: beforeError } = await supabase
      .from('messages')
      .select('id, direction, tokens_used, billing_status, cost_credits, created_at')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (beforeError) {
      console.error('❌ Erro ao buscar mensagens antes:', beforeError);
      return;
    }
    
    console.table(messagesBefore);
    
    // 2. Verificar saldos das organizações ANTES
     console.log('\n💰 [BEFORE] Saldos das organizações antes do teste:');
     const { data: orgsBefore, error: orgsBeforeError } = await supabase
       .from('organization_credits')
       .select('org_id, balance')
       .order('balance', { ascending: false });
     
     if (orgsBeforeError) {
       console.error('❌ Erro ao buscar organizações antes:', orgsBeforeError);
       return;
     }
     
     console.table(orgsBefore);
    
    // 3. Simular envio de mensagem via webhook (não vamos fazer isso aqui, apenas monitorar)
    console.log('\n⏳ [WAIT] Agora envie uma mensagem via WhatsApp para testar...');
    console.log('📱 Aguardando 30 segundos para você enviar uma mensagem...');
    
    // Aguardar 30 segundos
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // 4. Verificar mensagens DEPOIS do teste
    console.log('\n📊 [AFTER] Verificando mensagens após o teste:');
    const { data: messagesAfter, error: afterError } = await supabase
      .from('messages')
      .select('id, direction, tokens_used, billing_status, cost_credits, created_at')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (afterError) {
      console.error('❌ Erro ao buscar mensagens depois:', afterError);
      return;
    }
    
    console.table(messagesAfter);
    
    // 5. Verificar saldos DEPOIS
     console.log('\n💰 [AFTER] Saldos das organizações após o teste:');
     const { data: orgsAfter, error: orgsAfterError } = await supabase
       .from('organization_credits')
       .select('org_id, balance')
       .order('balance', { ascending: false });
     
     if (orgsAfterError) {
       console.error('❌ Erro ao buscar organizações depois:', orgsAfterError);
       return;
     }
     
     console.table(orgsAfter);
    
    // 6. Análise dos resultados
    console.log('\n🔍 [ANALYSIS] Análise dos resultados:');
    
    // Comparar mensagens
    const newMessages = messagesAfter.filter(after => 
      !messagesBefore.some(before => before.id === after.id)
    );
    
    if (newMessages.length > 0) {
      console.log(`✅ ${newMessages.length} nova(s) mensagem(ns) encontrada(s):`);
      newMessages.forEach(msg => {
        console.log(`  - ID: ${msg.id}`);
        console.log(`  - Tokens: ${msg.tokens_used} (deve ser > 0)`);
        console.log(`  - Status: ${msg.billing_status} (deve ser 'charged')`);
        console.log(`  - Créditos: ${msg.cost_credits}`);
        
        // Validações
        if (msg.tokens_used === 0) {
          console.log('  ❌ PROBLEMA: tokens_used ainda é 0!');
        } else {
          console.log('  ✅ OK: tokens_used > 0');
        }
        
        if (msg.billing_status !== 'charged') {
          console.log('  ❌ PROBLEMA: billing_status não é "charged"!');
        } else {
          console.log('  ✅ OK: billing_status é "charged"');
        }
      });
    } else {
      console.log('⚠️ Nenhuma nova mensagem encontrada. Certifique-se de ter enviado uma mensagem via WhatsApp.');
    }
    
    // Comparar saldos
     console.log('\n💰 Mudanças nos saldos:');
     orgsAfter.forEach(orgAfter => {
       const orgBefore = orgsBefore.find(b => b.org_id === orgAfter.org_id);
       if (orgBefore && orgBefore.balance !== orgAfter.balance) {
         const difference = orgBefore.balance - orgAfter.balance;
         console.log(`  - ${orgAfter.org_id}: ${orgBefore.balance} → ${orgAfter.balance} (${difference > 0 ? '-' : '+'}${Math.abs(difference)} créditos)`);
       }
     });
    
  } catch (error) {
    console.error('❌ [ERROR] Erro no teste:', error);
  }
}

testBillingFix();