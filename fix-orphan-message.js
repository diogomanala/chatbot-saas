const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrphanMessage() {
  console.log('🔧 Corrigindo mensagem outbound órfã sem billing_status...\n');

  try {
    // 1. Buscar mensagens outbound sem billing_status
    console.log('🔍 Buscando mensagens outbound sem billing_status...');
    const { data: orphanMessages, error } = await supabase
      .from('messages')
      .select('id, direction, message_content, billing_status, tokens_used, cost_credits, created_at, org_id')
      .eq('direction', 'outbound')
      .is('billing_status', null);

    if (error) {
      console.error('❌ Erro ao buscar mensagens órfãs:', error);
      return;
    }

    console.log(`📋 Encontradas ${orphanMessages?.length || 0} mensagens órfãs\n`);

    if (!orphanMessages || orphanMessages.length === 0) {
      console.log('✅ Nenhuma mensagem órfã encontrada!');
      return;
    }

    // 2. Processar cada mensagem órfã
    for (const message of orphanMessages) {
      console.log(`🔧 Processando mensagem: ${message.id}`);
      console.log(`   Conteúdo: "${(message.message_content || '').substring(0, 50)}..."`);
      console.log(`   Criado em: ${message.created_at}`);
      console.log(`   Org ID: ${message.org_id}`);

      // Calcular tokens se não existir
      let tokens = message.tokens_used || 0;
      if (tokens === 0 && message.message_content) {
        // Estimativa simples: 1 token por 4 caracteres
        tokens = Math.ceil(message.message_content.length / 4);
        console.log(`   📊 Tokens calculados: ${tokens}`);
      }

      // Calcular créditos (1 crédito por 200 tokens)
      const credits = Math.ceil(tokens / 200);
      console.log(`   💰 Créditos necessários: ${credits}`);

      // Verificar saldo da organização na tabela credit_wallets
      const { data: walletData, error: walletError } = await supabase
        .from('credit_wallets')
        .select('balance')
        .eq('org_id', message.org_id)
        .single();

      if (walletError) {
        console.error(`   ❌ Erro ao buscar saldo da org ${message.org_id}:`, walletError);
        continue;
      }

      const currentBalance = walletData?.balance || 0;
      console.log(`   💳 Saldo atual da org: ${currentBalance} créditos`);

      let newStatus = 'failed';
      let newBalance = currentBalance;

      if (currentBalance >= credits) {
        // Tem saldo suficiente - debitar
        newBalance = currentBalance - credits;
        newStatus = 'charged';
        
        // Atualizar saldo da organização na tabela credit_wallets
        const { error: balanceError } = await supabase
          .from('credit_wallets')
          .update({ balance: newBalance })
          .eq('org_id', message.org_id);

        if (balanceError) {
          console.error(`   ❌ Erro ao atualizar saldo:`, balanceError);
          continue;
        }

        console.log(`   ✅ Saldo debitado: ${currentBalance} → ${newBalance}`);
      } else {
        console.log(`   ❌ Saldo insuficiente para cobrança`);
      }

      // Atualizar status da mensagem
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          billing_status: newStatus,
          tokens_used: tokens,
          cost_credits: credits,
          charged_at: new Date().toISOString()
        })
        .eq('id', message.id);

      if (updateError) {
        console.error(`   ❌ Erro ao atualizar mensagem:`, updateError);
        continue;
      }

      console.log(`   ✅ Mensagem atualizada: billing_status = "${newStatus}"`);
      console.log('');
    }

    console.log('🎯 CORREÇÃO CONCLUÍDA!');
    console.log('✅ Todas as mensagens outbound órfãs foram processadas');
    console.log('✅ Status de cobrança definido baseado no saldo disponível');
    console.log('✅ Tokens e créditos calculados e registrados');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar a correção
fixOrphanMessage();