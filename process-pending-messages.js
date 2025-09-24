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

// Implementar a lógica do AutoDebitService localmente
class LocalAutoDebitService {
  static calculateTokens(messageContent, tokensUsed) {
    if (tokensUsed && tokensUsed > 0) {
      return tokensUsed;
    }
    // Fórmula: 1 token ≈ 4 caracteres
    return Math.ceil(messageContent.length / 4);
  }

  static calculateCredits(tokens) {
    // Fórmula: 1000 tokens = 1 crédito
    return Math.ceil(tokens / 1000);
  }

  static async getBalance(orgId) {
    try {
      const { data, error } = await supabase
        .from('organization_credits')
        .select('balance')
        .eq('org_id', orgId)
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, balance: data?.balance || 0 };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  static async debitCredits(orgId, credits, messageId, tokens) {
    try {
      // 1. Inserir transação no usage_ledger
      const { error: ledgerError } = await supabase
        .from('usage_ledger')
        .insert({
          org_id: orgId,
          transaction_type: 'debit',
          credits: -credits,
          description: `Débito automático - Mensagem ${messageId}`,
          metadata: {
            message_id: messageId,
            tokens_used: tokens,
            auto_debit: true,
            processed_at: new Date().toISOString()
          }
        });

      if (ledgerError) {
        return { success: false, message: ledgerError.message };
      }

      // 2. Atualizar saldo na organization_credits
      const { error: updateError } = await supabase
        .from('organization_credits')
        .update({ 
          balance: supabase.raw(`balance - ${credits}`),
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId);

      if (updateError) {
        return { success: false, message: updateError.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  static async updateMessageBillingStatus(messageId, status, tokens, credits) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          billing_status: status,
          tokens_used: tokens,
          cost_credits: credits,
          charged_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) {
        console.error(`❌ Erro ao atualizar mensagem ${messageId}:`, error);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Erro ao atualizar mensagem ${messageId}:`, error);
      return false;
    }
  }

  static async processMessage(message) {
    console.log(`\n🔄 Processando mensagem: ${message.id}`);
    console.log(`   Org: ${message.org_id}`);
    console.log(`   Conteúdo: "${message.message_content.substring(0, 50)}..."`);

    // 1. Calcular tokens e créditos
    const tokens = this.calculateTokens(message.message_content, message.tokens_used);
    const credits = this.calculateCredits(tokens);

    console.log(`   📏 Tokens: ${tokens}`);
    console.log(`   💳 Créditos necessários: ${credits}`);

    if (credits === 0) {
      console.log(`   ⏭️  Pulando - nenhum crédito necessário`);
      return { success: true, skipped: true };
    }

    // 2. Verificar saldo
    const balanceResult = await this.getBalance(message.org_id);
    if (!balanceResult.success) {
      console.log(`   ❌ Erro ao verificar saldo: ${balanceResult.message}`);
      return { success: false, message: balanceResult.message };
    }

    const currentBalance = balanceResult.balance;
    console.log(`   💰 Saldo atual: ${currentBalance}`);

    if (currentBalance < credits) {
      console.log(`   ❌ Saldo insuficiente`);
      await this.updateMessageBillingStatus(message.id, 'failed', tokens, credits);
      return { success: false, message: 'Saldo insuficiente' };
    }

    // 3. Realizar débito
    const debitResult = await this.debitCredits(message.org_id, credits, message.id, tokens);
    if (!debitResult.success) {
      console.log(`   ❌ Erro no débito: ${debitResult.message}`);
      await this.updateMessageBillingStatus(message.id, 'failed', tokens, credits);
      return { success: false, message: debitResult.message };
    }

    // 4. Atualizar status da mensagem
    const updateResult = await this.updateMessageBillingStatus(message.id, 'charged', tokens, credits);
    if (!updateResult) {
      console.log(`   ⚠️  Débito realizado mas falha ao atualizar mensagem`);
    }

    const newBalance = currentBalance - credits;
    console.log(`   ✅ Processado com sucesso!`);
    console.log(`   💰 Novo saldo: ${newBalance}`);

    return { 
      success: true, 
      tokensCalculated: tokens, 
      creditsDebited: credits, 
      balanceAfter: newBalance 
    };
  }
}

async function processPendingMessages() {
  try {
    console.log('🚀 Iniciando processamento de mensagens pendentes...');
    console.log('=' .repeat(60));

    // 1. Buscar mensagens pendentes
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, message_content, tokens_used, direction, org_id, billing_status, created_at')
      .eq('direction', 'outbound')
      .or('billing_status.is.null,billing_status.eq.pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return;
    }

    if (!messages || messages.length === 0) {
      console.log('✅ Nenhuma mensagem pendente encontrada');
      return;
    }

    console.log(`📊 Encontradas ${messages.length} mensagens pendentes`);

    // 2. Processar cada mensagem
    let processedCount = 0;
    let totalCreditsDebited = 0;
    let failedCount = 0;

    for (const message of messages) {
      const result = await LocalAutoDebitService.processMessage(message);
      
      if (result.success && !result.skipped) {
        processedCount++;
        totalCreditsDebited += result.creditsDebited || 0;
      } else if (!result.success) {
        failedCount++;
      }

      // Pequena pausa entre processamentos
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '=' .repeat(60));
    console.log('📈 RESUMO DO PROCESSAMENTO:');
    console.log(`   Mensagens analisadas: ${messages.length}`);
    console.log(`   Processadas com sucesso: ${processedCount}`);
    console.log(`   Falharam: ${failedCount}`);
    console.log(`   Total de créditos debitados: ${totalCreditsDebited}`);
    console.log('✅ Processamento concluído!');

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
  }
}

processPendingMessages();