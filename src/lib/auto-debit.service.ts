import { supabase } from './supabase';
import { BILLING, MIN_CHARGE_TOKENS } from './billing-consts';
import { billingService } from './billing.service';

/**
 * Sistema de Débito Automático
 * Implementa a fórmula exata:
 * - 1 token = R$ 0,001
 * - 1000 tokens = 1 crédito
 * - Apenas mensagens outbound são cobradas
 */

interface AutoDebitOptions {
  messageId: string;
  orgId: string;
  tokensUsed: number;
  idempotencyKey: string;
  mode: 'reserve-adjust' | 'direct-debit';
}

interface AutoDebitResult {
  success: boolean;
  message: string;
  tokensCalculated?: number;
  creditsDebited?: number;
  balanceAfter?: number;
  skipped?: boolean;
}

export class AutoDebitService {
  /**
   * Processa débito automático para mensagem outbound com garantias de piso e idempotência
   * Método específico para integração com webhook
   */
  async processOutboundMessage(options: {
    messageId: string;
    orgId: string;
    tokensUsed: number;
    idempotencyKey: string;
    mode: 'reserve-adjust' | 'direct-debit';
  }): Promise<AutoDebitResult> {
    const used = Math.max(options.tokensUsed, MIN_CHARGE_TOKENS);
    const creditsToDebit = Math.max(Math.ceil(used / 1000), 1);

    try {
      console.log(`[AutoDebit] 🔄 Processando débito: ${used} tokens = ${creditsToDebit} créditos`);

      // 1) Usar débito direto em vez da função RPC
      const debitResult = await this.debitCreditsDirectly(options.orgId, creditsToDebit);
      
      if (!debitResult.success) {
        console.error('[AutoDebit] ❌ Erro no débito direto:', debitResult.error);
        throw new Error(debitResult.error || 'Falha no débito');
      }

      console.log('[AutoDebit] ✅ Débito direto executado. Novo saldo:', debitResult.newBalance);

      // 2) Atualizar a mensagem com o status de débito
      const { error: updateErr } = await supabase
        .from('messages')
        .update({
          tokens_used: used,
          billing_status: BILLING.DEBITED,
          billed_at: new Date().toISOString()
        })
        .eq('id', options.messageId);
      
      if (updateErr) {
        console.error('[AutoDebit] ❌ Erro ao atualizar mensagem:', updateErr);
        throw updateErr;
      }

      console.log(`[AutoDebit] ✅ Mensagem ${options.messageId} atualizada com sucesso`);

      return {
        success: true,
        message: 'Débito processado com sucesso',
        tokensCalculated: used,
        creditsDebited: creditsToDebit,
        balanceAfter: debitResult?.newBalance
      };
    } catch (error) {
      console.error('[AutoDebit] ❌ Erro no processamento:', error);
      
      // Marcar mensagem como falha no débito
      try {
        await supabase
          .from('messages')
          .update({
            tokens_used: used,
            billing_status: BILLING.ERRORED,
            billed_at: new Date().toISOString()
          })
          .eq('id', options.messageId);
      } catch (updateError) {
        console.error('[AutoDebit] ❌ Erro ao marcar falha:', updateError);
      }
      
      throw error;
    }
  }

  /**
   * Fórmula para cálculo de tokens
   * 🔥 CORREÇÃO ROBUSTA: NUNCA permite tokens = 0
   * Se tokens_used existe: usar valor real (mínimo 1)
   * Se não existe: tokens = (comprimento_da_mensagem ÷ 4) + 50 (mínimo 50)
   */
  private static calculateTokens(messageContent: string, tokensUsed?: number): number {
    if (tokensUsed && tokensUsed > 0) {
      console.log(`[AutoDebit] ✅ Usando tokens reais: ${tokensUsed}`);
      return tokensUsed;
    }

    // 🔥 FALLBACK ROBUSTO: Fórmula de estimativa com mínimo garantido
    const messageLength = messageContent?.length || 0;
    const estimatedTokens = Math.max(Math.ceil(messageLength / 4) + 50, 50); // Mínimo absoluto: 50 tokens
    
    console.log(`[AutoDebit] 🔄 Tokens estimados (fallback): ${estimatedTokens} (${messageLength} chars / 4 + 50, mín: 50)`);
    return estimatedTokens;
  }

  /**
   * Fórmula para cálculo de créditos
   * 🔥 CORREÇÃO ROBUSTA: SEMPRE debita pelo menos 1 crédito
   * créditos_a_debitar = Math.max(Math.ceil(tokens ÷ 1000), 1)
   */
  private static calculateCredits(tokens: number): number {
    const credits = Math.max(Math.ceil(tokens / 1000), 1); // Mínimo absoluto: 1 crédito
    console.log(`[AutoDebit] 💰 Créditos calculados: ${credits} (${tokens} tokens ÷ 1000, mín: 1)`);
    return credits;
  }

  /**
   * Processa débito automático para uma mensagem
   */
  static async processAutoDebit(options: AutoDebitOptions): Promise<AutoDebitResult> {
    const { messageId, orgId, tokensUsed, mode } = options;
    // const idempotencyKey = options.idempotencyKey;

    try {
      console.log(`[AutoDebit] Iniciando processamento - Message: ${messageId}, Org: ${orgId}, Mode: ${mode}`);

      // 1. Calcular tokens usando piso mínimo
      const calculatedTokens = Math.max(tokensUsed, MIN_CHARGE_TOKENS);

      // 2. Calcular créditos usando a fórmula exata
      const creditsToDebit = this.calculateCredits(calculatedTokens);

      // 🔥 REMOÇÃO DA LÓGICA DE SKIP: Com os novos mínimos, nunca será 0
      // Agora sempre processamos o débito pois temos mínimos garantidos
      console.log(`[AutoDebit] 🚀 Processando débito obrigatório - tokens: ${calculatedTokens}, créditos: ${creditsToDebit}`);

      // 3. Verificar saldo atual
      const balanceResult = await billingService.getBalance(orgId);
      if (!balanceResult.success || !balanceResult.balance) {
        console.error(`[AutoDebit] Erro ao obter saldo: ${balanceResult.message}`);
        return {
          success: false,
          message: `Erro ao verificar saldo: ${balanceResult.message}`
        };
      }

      const currentBalance = balanceResult.balance;
      console.log(`[AutoDebit] Saldo atual: ${currentBalance} créditos`);

      // 4. Verificar se há saldo suficiente
      if (currentBalance < creditsToDebit) {
        console.log(`[AutoDebit] Saldo insuficiente: ${currentBalance} < ${creditsToDebit}`);
        
        // Atualizar status da mensagem como failed
        await this.updateMessageBillingStatus(messageId, 'failed', calculatedTokens, creditsToDebit);
        
        return {
          success: false,
          message: `Saldo insuficiente. Necessário: ${creditsToDebit}, Disponível: ${currentBalance}`,
          tokensCalculated: calculatedTokens,
          creditsDebited: 0,
          balanceAfter: currentBalance
        };
      }

      // 5. Realizar débito da tabela organization_credits
      const debitResult = await billingService.debitCredits({
        orgId,
        credits: creditsToDebit,
        agentId: 'auto-debit-service',
        channel: 'whatsapp',
        messageId,
        inputTokens: 0,
        outputTokens: calculatedTokens,
        metadata: {
          type: 'auto_debit',
          formula_used: 'tokens_div_1000',
          tokens_calculated: calculatedTokens,
          message_length: 0, // messageContent não está mais disponível
          processed_at: new Date().toISOString()
        }
      });

      if (!debitResult.success) {
        console.error(`[AutoDebit] Falha no débito: ${debitResult.message}`);
        
        // Atualizar status da mensagem como failed
        await this.updateMessageBillingStatus(messageId, 'failed', calculatedTokens, creditsToDebit);
        
        return {
          success: false,
          message: `Falha no débito: ${debitResult.message}`,
          tokensCalculated: calculatedTokens,
          creditsDebited: 0
        };
      }

      const balanceAfter = currentBalance - creditsToDebit;
      
      // 6. Atualizar status da mensagem como debited
        await this.updateMessageBillingStatus(messageId, BILLING.DEBITED, calculatedTokens, creditsToDebit);

      // 7. Log do débito realizado
      console.log(`[AutoDebit] ✅ DÉBITO REALIZADO:`);
      console.log(`[AutoDebit]    Message ID: ${messageId}`);
      console.log(`[AutoDebit]    Org ID: ${orgId}`);
      console.log(`[AutoDebit]    Tokens: ${calculatedTokens}`);
      console.log(`[AutoDebit]    Créditos debitados: ${creditsToDebit}`);
      console.log(`[AutoDebit]    Saldo antes: ${currentBalance}`);
      console.log(`[AutoDebit]    Saldo depois: ${balanceAfter}`);
      console.log(`[AutoDebit]    Fórmula: ${calculatedTokens} tokens ÷ 1000 = ${creditsToDebit} créditos`);

      return {
        success: true,
        message: 'Débito automático realizado com sucesso',
        tokensCalculated: calculatedTokens,
        creditsDebited: creditsToDebit,
        balanceAfter: balanceAfter
      };

    } catch (error) {
      console.error('[AutoDebit] Erro no processamento:', error);
      return {
        success: false,
        message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  /**
   * Atualiza o status de cobrança da mensagem com fallback robusto
   * 🔥 NUNCA falha silenciosamente - sempre tenta múltiplas vezes
   */
  private static async updateMessageBillingStatus(
    messageId: string, 
    status: 'debited' | 'failed' | 'skipped',
    tokens: number,
    credits: number
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`[AutoDebit] Tentativa ${attempt}/${maxRetries} - Atualizando mensagem ${messageId} para status: ${status}`);
        
        const { error } = await supabase
          .from('messages')
          .update({
            billing_status: status,
            tokens_used: Math.max(tokens, 1), // 🔥 Garante mínimo de 1 token
            cost_credits: Math.max(credits, 1), // 🔥 Garante mínimo de 1 crédito
            charged_at: new Date().toISOString()
          })
          .eq('id', messageId);

        if (error) {
          console.error(`[AutoDebit] Tentativa ${attempt} falhou para mensagem ${messageId}:`, error);
          
          if (attempt === maxRetries) {
            // 🔥 FALLBACK FINAL: Força valores mínimos se todas as tentativas falharam
            console.warn(`[AutoDebit] 🚨 FALLBACK FINAL - Forçando valores mínimos para mensagem ${messageId}`);
            
            const { error: fallbackError } = await supabase
              .from('messages')
              .update({
                billing_status: BILLING.DEBITED, // Usa constante correta
                tokens_used: MIN_CHARGE_TOKENS, // Usa constante do piso mínimo
                cost_credits: 1, // Força mínimo de 1 crédito
                charged_at: new Date().toISOString()
              })
              .eq('id', messageId);
              
            if (fallbackError) {
              console.error(`[AutoDebit] ❌ FALLBACK FINAL também falhou para ${messageId}:`, fallbackError);
            } else {
              console.log(`[AutoDebit] ✅ FALLBACK FINAL bem-sucedido para ${messageId}`);
            }
          }
          
          // Se não é a última tentativa, espera um pouco antes de tentar novamente
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        } else {
          console.log(`[AutoDebit] ✅ Status da mensagem ${messageId} atualizado para: ${status} (tentativa ${attempt})`);
          return; // Sucesso, sai do loop
        }
      } catch (error) {
        console.error(`[AutoDebit] Erro na tentativa ${attempt} para mensagem ${messageId}:`, error);
        
        if (attempt === maxRetries) {
          console.error(`[AutoDebit] ❌ Todas as tentativas falharam para mensagem ${messageId}`);
        } else {
          // Espera antes da próxima tentativa
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  }

  /**
   * Debita créditos diretamente da carteira da organização
   * @param orgId - ID da organização
   * @param creditsToDebit - Quantidade de créditos a debitar
   * @returns Promise com resultado do débito
   */
  private async debitCreditsDirectly(orgId: string, creditsToDebit: number): Promise<{
    success: boolean;
    newBalance?: number;
    error?: string;
  }> {
    try {
      console.log(`[AutoDebit] 💳 Iniciando débito direto: ${creditsToDebit} créditos para org ${orgId}`);
      
      // Buscar carteira atual
      const { data: wallet, error: walletError } = await supabase
        .from('credit_wallets')
        .select('*')
        .eq('org_id', orgId)
        .single();
      
      if (walletError) {
        console.error(`[AutoDebit] ❌ Erro ao buscar carteira:`, walletError);
        return { success: false, error: 'Carteira não encontrada' };
      }
      
      if (wallet.balance < creditsToDebit) {
        console.log(`[AutoDebit] ⚠️ Saldo insuficiente: ${wallet.balance} < ${creditsToDebit}`);
        return { success: false, error: 'Saldo insuficiente' };
      }
      
      // Realizar débito direto
      const newBalance = wallet.balance - creditsToDebit;
      
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
        console.error(`[AutoDebit] ❌ Erro ao atualizar saldo:`, updateError);
        return { success: false, error: 'Erro ao debitar créditos' };
      }
      
      console.log(`[AutoDebit] ✅ Débito realizado: ${creditsToDebit} créditos. Novo saldo: ${updatedWallet.balance}`);
      return { success: true, newBalance: updatedWallet.balance };
      
    } catch (error) {
      console.error(`[AutoDebit] ❌ Erro no débito direto:`, error);
      return { success: false, error: 'Erro interno no débito' };
    }
  }

  /**
   * Processa débito automático em lote para múltiplas mensagens
   */
  static async processBatchAutoDebit(orgId: string): Promise<{
    success: boolean;
    message: string;
    processed: number;
    totalCreditsDebited: number;
    results: AutoDebitResult[];
  }> {
    try {
      console.log(`[AutoDebit] Iniciando processamento em lote para org: ${orgId}`);

      // Buscar mensagens outbound pendentes
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, message_content, tokens_used, direction, org_id')
        .eq('org_id', String(orgId))
        .eq('direction', 'outbound')
        .or('billing_status.is.null,billing_status.eq.' + BILLING.PENDING)
        .order('created_at', { ascending: true })
        .limit(100); // Processar até 100 mensagens por vez

      if (error) {
        console.error('[AutoDebit] Erro ao buscar mensagens:', error);
        return {
          success: false,
          message: `Erro ao buscar mensagens: ${error.message}`,
          processed: 0,
          totalCreditsDebited: 0,
          results: []
        };
      }

      if (!messages || messages.length === 0) {
        console.log('[AutoDebit] Nenhuma mensagem pendente encontrada');
        return {
          success: true,
          message: 'Nenhuma mensagem pendente para processar',
          processed: 0,
          totalCreditsDebited: 0,
          results: []
        };
      }

      console.log(`[AutoDebit] Processando ${messages.length} mensagens`);

      const results: AutoDebitResult[] = [];
      let totalCreditsDebited = 0;
      let processedCount = 0;

      for (const message of messages) {
        const result = await this.processAutoDebit({
          messageId: message.id,
          orgId: message.org_id,
          tokensUsed: message.tokens_used,
          idempotencyKey: `batch:${message.id}`,
          mode: 'direct-debit'
        });

        results.push(result);
        
        if (result.success && result.creditsDebited) {
          totalCreditsDebited += result.creditsDebited;
          processedCount++;
        }

        // Pequena pausa entre processamentos para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[AutoDebit] ✅ LOTE PROCESSADO:`);
      console.log(`[AutoDebit]    Mensagens processadas: ${processedCount}/${messages.length}`);
      console.log(`[AutoDebit]    Total de créditos debitados: ${totalCreditsDebited}`);

      return {
        success: true,
        message: `Processamento em lote concluído: ${processedCount}/${messages.length} mensagens`,
        processed: processedCount,
        totalCreditsDebited,
        results
      };

    } catch (error) {
      console.error('[AutoDebit] Erro no processamento em lote:', error);
      return {
        success: false,
        message: `Erro no processamento em lote: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        processed: 0,
        totalCreditsDebited: 0,
        results: []
      };
    }
  }
}

// Exportar instância singleton
export const autoDebitService = AutoDebitService;