const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugTokens() {
  console.log('🔍 DEBUGANDO PROBLEMA DOS TOKENS = 0\n');
  
  try {
    // 1. Verificar mensagens recentes
    console.log('📨 Verificando mensagens recentes...');
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return;
    }
    
    console.log(`\n📊 Encontradas ${messages.length} mensagens:\n`);
    
    let outboundWithZeroTokens = 0;
    let outboundWithTokens = 0;
    
    messages.forEach((msg, i) => {
      const tokens = msg.tokens_used || 0;
      const content = msg.message_content || msg.content || '';
      
      console.log(`📨 Mensagem ${i+1}:`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Direção: ${msg.direction}`);
      console.log(`   Conteúdo: "${content.substring(0, 50)}..."`);
      console.log(`   Tokens: ${tokens}`);
      console.log(`   Status: ${msg.billing_status}`);
      console.log(`   Créditos: ${msg.cost_credits || 0}`);
      console.log(`   Data: ${msg.created_at}`);
      
      if (msg.direction === 'outbound') {
        if (tokens === 0) {
          outboundWithZeroTokens++;
          console.log(`   ⚠️ PROBLEMA: Mensagem outbound com tokens = 0!`);
        } else {
          outboundWithTokens++;
          console.log(`   ✅ OK: Mensagem outbound com tokens = ${tokens}`);
        }
      }
      console.log('');
    });
    
    // 2. Resumo do problema
    console.log('📊 RESUMO DO PROBLEMA:');
    console.log(`   Mensagens outbound com tokens = 0: ${outboundWithZeroTokens}`);
    console.log(`   Mensagens outbound com tokens > 0: ${outboundWithTokens}`);
    
    if (outboundWithZeroTokens > 0) {
      console.log('\n🚨 PROBLEMA IDENTIFICADO:');
      console.log('   Mensagens outbound estão sendo salvas com tokens_used = 0');
      console.log('   Isso impede a cobrança correta');
    }
    
    // 3. Verificar saldo da organização
    console.log('\n💰 Verificando saldos das organizações...');
    const { data: credits, error: creditsError } = await supabase
      .from('organization_credits')
      .select('*');
      
    if (creditsError) {
      console.error('❌ Erro ao buscar créditos:', creditsError);
    } else {
      credits.forEach(org => {
        console.log(`   Org ${org.org_id}: ${org.balance} créditos`);
      });
    }
    
    // 4. Testar cálculo de tokens
    console.log('\n🔢 TESTANDO CÁLCULO DE TOKENS:');
    const testMessages = [
      'Olá, como posso ajudar?',
      'Esta é uma mensagem de teste para verificar o cálculo de tokens.',
      'Mensagem muito longa para testar se o cálculo está funcionando corretamente com textos maiores que podem ter mais tokens.'
    ];
    
    testMessages.forEach((text, i) => {
      const estimatedTokens = Math.max(Math.ceil(text.length / 4) + 50, 50);
      const credits = Math.max(Math.ceil(estimatedTokens / 1000), 1);
      
      console.log(`   Teste ${i+1}: "${text.substring(0, 30)}..."`);
      console.log(`     Caracteres: ${text.length}`);
      console.log(`     Tokens estimados: ${estimatedTokens}`);
      console.log(`     Créditos: ${credits}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugTokens();