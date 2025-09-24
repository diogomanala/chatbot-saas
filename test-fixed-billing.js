const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Função para calcular custo em créditos
function calculateCreditCost(tokensUsed, inputTokens = 0) {
  const INPUT_TOKEN_COST = 0.0015; // $0.0015 per 1K input tokens
  const OUTPUT_TOKEN_COST = 0.002;  // $0.002 per 1K output tokens
  const USD_TO_BRL = 5.5; // Aproximação
  const CREDIT_VALUE = 0.01; // R$ 0,01 por crédito
  
  const outputTokens = tokensUsed - inputTokens;
  const inputCostUSD = (inputTokens / 1000) * INPUT_TOKEN_COST;
  const outputCostUSD = (outputTokens / 1000) * OUTPUT_TOKEN_COST;
  const totalCostBRL = (inputCostUSD + outputCostUSD) * USD_TO_BRL;
  
  return Math.max(1, Math.ceil(totalCostBRL / CREDIT_VALUE));
}

async function testFixedBillingSystem() {
  try {
    console.log('🧪 [TESTE] Sistema de Cobrança Corrigido\n');
    
    // 1. Verificar mensagens pendentes
    console.log('1️⃣ Verificando mensagens pendentes...');
    const { data: pendingMessages, error: pendingError } = await supabase
      .from('messages')
      .select('*')
      .eq('billing_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (pendingError) {
      console.error('❌ Erro ao buscar mensagens pendentes:', pendingError);
      return;
    }
    
    console.log(`📊 Mensagens pendentes encontradas: ${pendingMessages?.length || 0}`);
    
    if (pendingMessages && pendingMessages.length > 0) {
      console.log('\n📋 Detalhes das mensagens pendentes:');
      pendingMessages.forEach((msg, index) => {
        console.log(`${index + 1}. ID: ${msg.id}`);
        console.log(`   📞 ${msg.direction}: ${msg.sender_phone} → ${msg.receiver_phone}`);
        console.log(`   💬 Conteúdo: "${(msg.message_content || msg.content || '').substring(0, 50)}..."`);
        console.log(`   🔢 Tokens: ${msg.tokens_used || 0}`);
        console.log(`   📅 Criado: ${new Date(msg.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });
    }
    
    // 2. Processar mensagens pendentes
    console.log('2️⃣ Processando mensagens pendentes...');
    let processedCount = 0;
    let totalCreditsCharged = 0;
    
    for (const message of pendingMessages || []) {
      try {
        console.log(`\n🔄 Processando mensagem ${message.id}...`);
        
        let tokensUsed = message.tokens_used || 0;
        let costCredits = 0;
        
        // Se tokens_used é 0, estimar baseado no conteúdo
        const messageContent = message.message_content || message.content;
        if (tokensUsed === 0 && messageContent) {
          tokensUsed = Math.max(1, Math.ceil(messageContent.length / 4) + 50);
          console.log(`   🔢 Tokens estimados: ${tokensUsed}`);
          
          // Atualizar tokens_used na mensagem
          await supabase
            .from('messages')
            .update({ tokens_used: tokensUsed })
            .eq('id', message.id);
        }
        
        // Calcular custo apenas para mensagens outbound
        if (message.direction === 'outbound' && tokensUsed > 0) {
          costCredits = calculateCreditCost(tokensUsed, 0);
          console.log(`   💰 Custo calculado: ${costCredits} créditos`);
          
          // Verificar saldo da organização
          const { data: wallet } = await supabase
            .from('credit_wallets')
            .select('id, balance')
            .eq('org_id', message.org_id)
            .single();
          
          if (!wallet) {
            console.log(`   ❌ Carteira não encontrada para org ${message.org_id}`);
            continue;
          }
          
          if (wallet.balance < costCredits) {
            console.log(`   ⚠️  Saldo insuficiente (${wallet.balance} < ${costCredits})`);
            
            // Marcar como failed
            await supabase
              .from('messages')
              .update({
                billing_status: 'failed',
                cost_credits: costCredits,
                charged_at: new Date().toISOString()
              })
              .eq('id', message.id);
            
            console.log(`   ❌ Mensagem marcada como 'failed' - saldo insuficiente`);
          } else {
            // Debitar créditos
            const { error: debitError } = await supabase
              .from('credit_wallets')
              .update({ 
                balance: wallet.balance - costCredits,
                updated_at: new Date().toISOString()
              })
              .eq('id', wallet.id);
            
            if (debitError) {
              console.error(`   ❌ Erro ao debitar créditos:`, debitError);
              continue;
            }
            
            // Marcar como charged
            await supabase
              .from('messages')
              .update({
                billing_status: 'charged',
                cost_credits: costCredits,
                charged_at: new Date().toISOString()
              })
              .eq('id', message.id);
            
            totalCreditsCharged += costCredits;
            console.log(`   ✅ ${costCredits} créditos debitados - Novo saldo: ${wallet.balance - costCredits}`);
          }
        } else if (message.direction === 'inbound') {
          // Mensagens inbound não são cobradas
          await supabase
            .from('messages')
            .update({
              billing_status: 'skipped',
              cost_credits: 0,
              charged_at: new Date().toISOString()
            })
            .eq('id', message.id);
          
          console.log(`   ⏭️  Mensagem inbound marcada como 'skipped'`);
        } else {
          // Mensagem sem tokens
          await supabase
            .from('messages')
            .update({
              billing_status: 'skipped',
              cost_credits: 0,
              charged_at: new Date().toISOString()
            })
            .eq('id', message.id);
          
          console.log(`   ⏭️  Mensagem sem tokens marcada como 'skipped'`);
        }
        
        processedCount++;
        
      } catch (msgError) {
        console.error(`   ❌ Erro ao processar mensagem ${message.id}:`, msgError);
      }
    }
    
    // 3. Verificar status final
    console.log('\n3️⃣ Verificando status final...');
    const { data: finalStats } = await supabase
      .from('messages')
      .select('billing_status')
      .not('billing_status', 'is', null);
    
    const statusCounts = {};
    finalStats?.forEach(msg => {
      const status = msg.billing_status || 'null';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('📊 Status das mensagens:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} mensagens`);
    });
    
    // 4. Verificar saldos das carteiras
    console.log('\n4️⃣ Saldos das carteiras:');
    const { data: wallets } = await supabase
      .from('credit_wallets')
      .select('org_id, balance')
      .order('balance', { ascending: false });
    
    wallets?.forEach(wallet => {
      console.log(`   Org ${wallet.org_id}: ${wallet.balance} créditos`);
    });
    
    console.log('\n📊 [RESUMO]');
    console.log(`✅ Mensagens processadas: ${processedCount}`);
    console.log(`💰 Total de créditos debitados: ${totalCreditsCharged}`);
    console.log('🎉 Teste concluído!\n');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testFixedBillingSystem();