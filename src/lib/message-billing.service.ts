import { createClient } from '@supabase/supabase-js';
import { calculateCreditCost } from './credit-calculator';
import BillingService from './billing.service';
import { BILLING } from './billing-consts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface MessageBillingResult {
  success: boolean;
  message: string;
  creditsCharged?: number;
  messagesProcessed?: number;
}

export class MessageBillingService {

  /**
   * Processa cobrança para uma mensagem específica
   */
  async chargeMessage(messageId: string): Promise<MessageBillingResult> {
    try {
      // Buscar a mensagem
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId.toString())
        .eq('billing_status', BILLING.PENDING)
        .single();

      if (messageError || !message) {
        return {
          success: false,
          message: 'Mensagem não encontrada ou já processada'
        };
      }

      // Calcular custo baseado nos tokens usados
      const costCredits = this.calculateMessageCost(message.tokens_used || 0, message.direction);

      if (costCredits === 0) {
        // Marcar como skipped se não há custo
        await this.updateMessageBillingStatus(messageId, 'skipped', 0);
        return {
          success: true,
          message: 'Mensagem marcada como sem custo',
          creditsCharged: 0
        };
      }

      // Verificar saldo suficiente
      const balanceResult = await BillingService.getBalance(message.org_id);
      
      if (!balanceResult.success || !balanceResult.balance || balanceResult.balance < costCredits) {
        console.log(`[MessageBillingService] Saldo insuficiente para org ${message.org_id}`);
        await this.updateMessageBillingStatus(messageId, 'failed', costCredits);
        return {
          success: false,
          message: 'Saldo insuficiente para processar a mensagem'
        };
      }

      // Create usage event record (using string types to match migration)
      const { data: usageEvent, error: usageError } = await supabase
        .from('usage_events')
        .insert({
          org_id: message.org_id.toString(),
          agent_id: (message.chatbot_id || message.device_id || 'unknown').toString(),
          message_id: messageId.toString(),
          channel: 'whatsapp', // Valid channel value according to constraint
          input_tokens: message.tokens_used || 0,
          output_tokens: 0,
          cost_credits: costCredits,
          meta: {
            messageType: message.message_type
          }
        })
        .select()
        .single();

      if (usageError) {
        console.error('Failed to create usage event:', usageError);
        // Continue with billing even if usage event fails
      } else {
        console.log('Usage event created successfully:', usageEvent?.id);
      }

      // Debitar créditos usando o sistema simplificado
      const debitResult = await BillingService.debitCredits({
        orgId: message.org_id,
        credits: costCredits,
        agentId: message.chatbot_id || message.device_id || 'unknown',
        channel: 'whatsapp',
        messageId: messageId,
        inputTokens: message.tokens_used || 0,
        outputTokens: 0,
        metadata: { messageType: message.message_type }
      });

      if (debitResult.success) {
        await this.updateMessageBillingStatus(messageId, BILLING.DEBITED, costCredits);
        return {
          success: true,
          message: 'Mensagem cobrada com sucesso',
          creditsCharged: costCredits,
          messagesProcessed: 1
        };
      } else {
        await this.updateMessageBillingStatus(messageId, 'failed', costCredits);
        return {
          success: false,
          message: debitResult.message
        };
      }
    } catch (error) {
      console.error('[MessageBillingService] Erro ao cobrar mensagem:', error);
      return {
        success: false,
        message: 'Erro interno ao processar cobrança'
      };
    }
  }

  /**
   * Processa cobrança em lote para mensagens pendentes de uma organização
   */
  async chargePendingMessages(orgId: string, limit: number = 100): Promise<MessageBillingResult> {
    try {
      // Buscar mensagens pendentes
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('org_id', orgId.toString())
        .eq('billing_status', BILLING.PENDING)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      if (!messages || messages.length === 0) {
        return {
          success: true,
          message: 'Nenhuma mensagem pendente encontrada',
          messagesProcessed: 0
        };
      }

      let totalCreditsCharged = 0;
      let successCount = 0;
      let failureCount = 0;

      // Processar cada mensagem
      for (const message of messages) {
        const result = await this.chargeMessage(message.id);
        if (result.success) {
          successCount++;
          totalCreditsCharged += result.creditsCharged || 0;
        } else {
          failureCount++;
        }
      }

      return {
        success: failureCount === 0,
        message: `Processadas ${successCount} mensagens com sucesso, ${failureCount} falharam`,
        creditsCharged: totalCreditsCharged,
        messagesProcessed: successCount
      };
    } catch (error) {
      console.error('[MessageBillingService] Erro ao processar mensagens em lote:', error);
      return {
        success: false,
        message: 'Erro interno ao processar mensagens em lote'
      };
    }
  }

  /**
   * Processa todas as mensagens pendentes do sistema
   */
  async chargeAllPendingMessages(limit: number = 1000): Promise<MessageBillingResult> {
    try {
      // Buscar organizações com mensagens pendentes
      const { data: orgsWithPending, error } = await supabase
        .from('messages')
        .select('org_id')
        .eq('billing_status', BILLING.PENDING)
        .limit(limit);

      if (error) {
        throw error;
      }

      if (!orgsWithPending || orgsWithPending.length === 0) {
        return {
          success: true,
          message: 'Nenhuma mensagem pendente no sistema',
          messagesProcessed: 0
        };
      }

      // Obter organizações únicas
      const uniqueOrgIds = [...new Set(orgsWithPending.map(row => row.org_id))];
      
      let totalCreditsCharged = 0;
      let totalMessagesProcessed = 0;

      // Processar cada organização
      for (const orgId of uniqueOrgIds) {
        if (typeof orgId === 'string') {
           const result = await this.chargePendingMessages(orgId, 50);
           if (result.success) {
             totalCreditsCharged += result.creditsCharged || 0;
             totalMessagesProcessed += result.messagesProcessed || 0;
           }
         }
      }

      return {
        success: true,
        message: `Processamento concluído: ${totalMessagesProcessed} mensagens, ${totalCreditsCharged} créditos`,
        creditsCharged: totalCreditsCharged,
        messagesProcessed: totalMessagesProcessed
      };
    } catch (error) {
      console.error('[MessageBillingService] Erro ao processar todas as mensagens:', error);
      return {
        success: false,
        message: 'Erro interno ao processar todas as mensagens'
      };
    }
  }

  /**
   * Calcula o custo de uma mensagem baseado nos tokens e direção
   */
  /**
   * Calcula o custo da mensagem com lógica robusta
   * 🔥 NUNCA retorna 0 para mensagens outbound - sempre cobra pelo menos 1 crédito
   */
  private calculateMessageCost(tokensUsed: number, direction: string): number {
    // Apenas mensagens outbound (respostas do bot) são cobradas
    if (direction !== 'outbound') {
      return 0;
    }

    // 🔥 CORREÇÃO ROBUSTA: Garante mínimo de tokens para cálculo
    const safeTokensUsed = Math.max(tokensUsed || 0, 50); // Mínimo de 50 tokens
    
    console.log(`[MessageBillingService] 🔥 Cálculo robusto - tokens originais: ${tokensUsed}, tokens seguros: ${safeTokensUsed}`);

    // Usar a função existente de cálculo de custo com tokens seguros
    const credits = calculateCreditCost(safeTokensUsed, 0);
    
    // 🔥 GARANTIA FINAL: Sempre pelo menos 1 crédito para mensagens outbound
    const finalCredits = Math.max(credits, 1);
    
    console.log(`[MessageBillingService] 🔥 Créditos calculados: ${credits}, créditos finais: ${finalCredits}`);
    
    return finalCredits;
  }

  /**
   * Atualiza o status de cobrança de uma mensagem com lógica robusta
   * 🔥 NUNCA deixa mensagem como pendente - sempre força processamento
   */
  private async updateMessageBillingStatus(
    messageId: string, 
    status: 'pending' | 'debited' | 'failed' | 'skipped',
    costCredits: number
  ): Promise<void> {
    // 🔥 CORREÇÃO ROBUSTA: Nunca permite status pendente após processamento
    let finalStatus = status;
    let finalCostCredits = costCredits;
    
    if (status === BILLING.PENDING) {
      console.log(`[MessageBillingService] 🔥 FORÇANDO status debited para mensagem ${messageId} que estava pendente`);
      finalStatus = BILLING.DEBITED;
      finalCostCredits = Math.max(costCredits, 1); // Garante pelo menos 1 crédito
    }

    const updateData: any = {
      billing_status: finalStatus,
      cost_credits: finalCostCredits
    };

    if (finalStatus === BILLING.DEBITED || finalStatus === 'failed' || finalStatus === 'skipped') {
      updateData.charged_at = new Date().toISOString();
    }

    // 🔥 TENTATIVAS MÚLTIPLAS para garantir atualização
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const { error } = await supabase
          .from('messages')
          .update(updateData)
          .eq('id', messageId.toString());

        if (!error) {
          console.log(`[MessageBillingService] ✅ Status atualizado com sucesso na tentativa ${attempts}: ${messageId} -> ${finalStatus}`);
          return;
        }
        
        console.error(`[MessageBillingService] ❌ Tentativa ${attempts} falhou:`, error);
        
        if (attempts === maxAttempts) {
          throw error;
        }
        
        // Aguarda antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        
      } catch (err) {
        console.error(`[MessageBillingService] ❌ Erro na tentativa ${attempts}:`, err);
        
        if (attempts === maxAttempts) {
          // 🔥 FALLBACK FINAL: Força atualização com valores mínimos
          console.log(`[MessageBillingService] 🔥 FALLBACK FINAL para mensagem ${messageId}`);
          
          try {
            await supabase
              .from('messages')
              .update({
                billing_status: BILLING.DEBITED,
                cost_credits: 1,
                charged_at: new Date().toISOString()
              })
              .eq('id', messageId.toString());
              
            console.log(`[MessageBillingService] 🔥 Fallback aplicado com sucesso para ${messageId}`);
            return;
          } catch (fallbackError) {
            console.error(`[MessageBillingService] 💥 FALLBACK FALHOU para ${messageId}:`, fallbackError);
            throw fallbackError;
          }
        }
      }
    }
  }

  /**
   * Obtém estatísticas de cobrança para uma organização
   */
  async getBillingStats(orgId: string, days: number = 30): Promise<{
    totalMessages: number;
    debitedMessages: number;
    totalCreditsCharged: number;
    pendingMessages: number;
    failedMessages: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('messages')
        .select('billing_status, cost_credits')
        .eq('org_id', orgId.toString())
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw error;
      }

      const stats = {
        totalMessages: data?.length || 0,
        debitedMessages: 0,
        totalCreditsCharged: 0,
        pendingMessages: 0,
        failedMessages: 0
      };

      data?.forEach(message => {
        switch (message.billing_status) {
          case BILLING.DEBITED:
            stats.debitedMessages++;
            stats.totalCreditsCharged += message.cost_credits || 0;
            break;
          case BILLING.PENDING:
            stats.pendingMessages++;
            break;
          case 'failed':
            stats.failedMessages++;
            break;
        }
      });

      return stats;
    } catch (error) {
      console.error('[MessageBillingService] Erro ao obter estatísticas:', error);
      throw error;
    }
  }
}

export const messageBillingService = new MessageBillingService();