require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Função para calcular custo em créditos (1000 tokens = 1 crédito)
function calculateCreditCost(inputTokens, outputTokens) {
  const totalTokens = inputTokens + outputTokens;
  return Math.ceil(totalTokens / 1000); // Arredondar para cima
}

// Função para estimar tokens baseado no conteúdo da mensagem
function estimateTokens(content) {
  if (!content) return 0;
  
  // Estimativa: ~4 caracteres por token (aproximação para português)
  const estimatedTokens = Math.ceil(content.length / 4);
  
  // Adicionar tokens do sistema (prompt base)
  const systemTokens = 50; // Estimativa para prompt do sistema
  
  return estimatedTokens + systemTokens;
}

async function processPendingMessages() {
  try {
    console.log('🔄 [PROCESSANDO MENSAGENS PENDENTES]\n');
    
    // Buscar todas as mensagens pendentes
    const { data: pendingMessages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('billing_status', 'pending')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('❌ Erro ao buscar mensagens pendentes:', error);
      return;
    }
    
    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('✅ Nenhuma mensagem pendente encontrada.');
      return;
    }
    
    console.log(`📊 Encontradas ${pendingMessages.length} mensagens pendentes\n`);
    
    let processedCount = 0;
    let totalCreditsCharged = 0;
    
    for (const message of pendingMessages) {
      try {
        console.log(`📱 Processando mensagem ${message.id}...`);
        console.log(`   📤 Direção: ${message.direction}`);
        console.log(`   📞 De: ${message.sender_phone} Para: ${message.receiver_phone}`);
        
        let tokensUsed = message.tokens_used || 0;
        let costCredits = 0;
        
        // Se tokens_used é 0, estimar baseado no conteúdo
        const messageContent = message.content || message.message_content;
        if (tokensUsed === 0 && messageContent) {
          tokensUsed = estimateTokens(messageContent);
          console.log(`   🔢 Tokens estimados: ${tokensUsed} (baseado em: "${messageContent.substring(0, 50)}...")`);
          
          // Atualizar tokens_used na mensagem
          await supabase
            .from('messages')
            .update({ tokens_used: tokensUsed })
            .eq('id', message.id);
        } else {
          console.log(`   🔢 Tokens já definidos: ${tokensUsed}`);
        }
        
        // Calcular custo apenas para mensagens outbound (respostas do bot)
        if (message.direction === 'outbound' && tokensUsed > 0) {
          costCredits = calculateCreditCost(tokensUsed, 0);
          console.log(`   💰 Custo calculado: ${costCredits} créditos`);
          
          // Verificar se a organização tem saldo suficiente
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
            
            console.log(`   ❌ Mensagem marcada como 'failed'`);
            continue;
          }
          
          // Debitar créditos da carteira usando RPC
          const { data: debitResult, error: debitError } = await supabase
            .rpc('simple_debit_credits', {
              p_org_id: message.org_id,
              p_agent_id: 'system',
              p_input_tokens: tokensUsed,
              p_output_tokens: 0,
              p_cost_credits: costCredits,
              p_channel: 'whatsapp',
              p_message_id: message.id,
              p_meta: {
                processed_by: 'batch-script',
                original_direction: message.direction,
                processed_at: new Date().toISOString()
              }
            });
          
          if (debitError) {
            console.log(`   ❌ Erro ao debitar créditos:`, debitError);
            continue;
          }
          
          // Marcar mensagem como charged
          await supabase
            .from('messages')
            .update({
              billing_status: 'charged',
              cost_credits: costCredits,
              charged_at: new Date().toISOString()
            })
            .eq('id', message.id);
          
          // Registrar transação
          await supabase
            .from('transactions')
            .insert({
              org_id: message.org_id,
              type: 'debit',
              amount: costCredits,
              description: `Cobrança por mensagem ${message.id}`,
              metadata: {
                message_id: message.id,
                tokens_used: tokensUsed,
                direction: message.direction,
                processed_retroactively: true
              }
            });
          
          totalCreditsCharged += costCredits;
          console.log(`   ✅ Mensagem processada - ${costCredits} créditos debitados`);
          
        } else if (message.direction === 'inbound') {
          // Mensagens inbound não são cobradas, marcar como skipped
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
          // Mensagem outbound sem tokens, marcar como skipped
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
        console.log(`   ✅ Processada (${processedCount}/${pendingMessages.length})\n`);
        
      } catch (msgError) {
        console.error(`   ❌ Erro ao processar mensagem ${message.id}:`, msgError);
      }
    }
    
    console.log('\n📊 [RESUMO DO PROCESSAMENTO]');
    console.log(`✅ Mensagens processadas: ${processedCount}`);
    console.log(`💰 Total de créditos debitados: ${totalCreditsCharged}`);
    console.log('🎉 Processamento concluído!\n');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

processPendingMessages();