/**
 * Serviço para contagem automática de mensagens e débito de créditos
 * Implementa a sugestão do usuário de contar mensagens e aplicar fórmula automática
 */

import { supabase } from './supabase';
import { billingService } from './billing.service';
import { BILLING } from './billing-consts';
import { calculateCreditCost } from './credit-calculator';

interface MessageCountResult {
  success: boolean;
  message: string;
  messagesProcessed?: number;
  creditsDebited?: number;
  currentBalance?: number;
}

interface MessageUpdate {
  id: string;
  tokens_used: number;
  cost_credits: number;
}

export class MessageCounterService {
  
  /**
   * Conta mensagens registradas e aplica fórmula para débito automático
   * Esta é a implementação da sugestão do usuário
   */
  async processMessageCountAndDebit(orgId: string): Promise<MessageCountResult> {
    try {
      console.log(`[MessageCounter] Iniciando contagem e débito automático para org: ${orgId}`);
      
      // 1. Contar mensagens outbound (respostas do bot) sem billing_status ou pendentes
      const { data: messages, error: countError } = await supabase
        .from('messages')
        .select('id, tokens_used, message_content, created_at, chatbot_id')
        .eq('org_id', String(orgId))
        .eq('direction', 'outbound')
        .or('billing_status.is.null,billing_status.eq.' + BILLING.PENDING)
        .order('created_at', { ascending: true });
      
      if (countError) {
        console.error('[MessageCounter] Erro ao contar mensagens:', countError);
        return {
          success: false,
          message: 'Erro ao contar mensagens'
        };
      }
      
      if (!messages || messages.length === 0) {
        console.log('[MessageCounter] Nenhuma mensagem pendente encontrada');
        return {
          success: true,
          message: 'Nenhuma mensagem pendente para processar',
          messagesProcessed: 0,
          creditsDebited: 0
        };
      }
      
      console.log(`[MessageCounter] Encontradas ${messages.length} mensagens para processar`);
      
      // 2. Aplicar fórmula automática para cada mensagem
      let totalCreditsToDebit = 0;
      const messageUpdates: MessageUpdate[] = [];
      
      for (const message of messages) {
        // Fórmula automática: estimar tokens se não existir
        let tokensUsed = message.tokens_used;
        
        if (!tokensUsed || tokensUsed === 0) {
          // Fórmula simples: ~4 caracteres por token + 50 tokens de sistema
          const messageLength = message.message_content?.length || 0;
          tokensUsed = Math.ceil(messageLength / 4) + 50;
          
          console.log(`[MessageCounter] Tokens estimados para mensagem ${message.id}: ${tokensUsed}`);
        }
        
        // Calcular créditos (1000 tokens = 1 crédito)
        const creditsForMessage = calculateCreditCost(tokensUsed, 0);
        totalCreditsToDebit += creditsForMessage;
        
        messageUpdates.push({
          id: message.id,
          tokens_used: tokensUsed,
          cost_credits: creditsForMessage
        });
      }
      
      console.log(`[MessageCounter] Total de créditos a debitar: ${totalCreditsToDebit}`);
      
      // 3. Verificar saldo suficiente
      const balanceResult = await billingService.getBalance(orgId);
      if (!balanceResult.success || !balanceResult.balance || balanceResult.balance < totalCreditsToDebit) {
        console.log(`[MessageCounter] Saldo insuficiente: ${balanceResult.balance} < ${totalCreditsToDebit}`);
        
        // Marcar mensagens como failed
        for (const update of messageUpdates) {
          await supabase
            .from('messages')
            .update({
              billing_status: 'failed',
              cost_credits: update.cost_credits,
              tokens_used: update.tokens_used,
              charged_at: new Date().toISOString()
            })
            .eq('id', update.id);
        }
        
        return {
          success: false,
          message: `Saldo insuficiente. Necessário: ${totalCreditsToDebit}, Disponível: ${balanceResult.balance}`,
          messagesProcessed: messages.length,
          creditsDebited: 0,
          currentBalance: balanceResult.balance
        };
      }
      
      // 4. Debitar créditos em lote
      const debitResult = await billingService.debitCredits({
        orgId: orgId,
        credits: totalCreditsToDebit,
        agentId: 'message-counter-service',
        channel: 'whatsapp',
        messageId: `batch-${Date.now()}`,
        inputTokens: 0,
        outputTokens: messageUpdates.reduce((sum, msg) => sum + msg.tokens_used, 0),
        metadata: {
          type: 'batch_message_processing',
          message_count: messages.length,
          processed_at: new Date().toISOString()
        }
      });
      
      if (!debitResult.success) {
        console.error('[MessageCounter] Falha no débito:', debitResult.message);
        return {
          success: false,
          message: `Falha no débito: ${debitResult.message}`
        };
      }
      
      // 5. Atualizar status das mensagens como debited
      for (const update of messageUpdates) {
        await supabase
          .from('messages')
          .update({
            billing_status: BILLING.DEBITED,
            cost_credits: update.cost_credits,
            tokens_used: update.tokens_used,
            charged_at: new Date().toISOString()
          })
          .eq('id', update.id);
      }
      
      // 6. Obter saldo atualizado
      const newBalanceResult = await billingService.getBalance(orgId);
      const newBalance = newBalanceResult.balance || 0;
      
      console.log(`[MessageCounter] Processamento concluído:`);
      console.log(`  - Mensagens processadas: ${messages.length}`);
      console.log(`  - Créditos debitados: ${totalCreditsToDebit}`);
      console.log(`  - Saldo atual: ${newBalance}`);
      
      return {
        success: true,
        message: `${messages.length} mensagens processadas com sucesso`,
        messagesProcessed: messages.length,
        creditsDebited: totalCreditsToDebit,
        currentBalance: newBalance
      };
      
    } catch (error) {
      console.error('[MessageCounter] Erro no processamento:', error);
      return {
        success: false,
        message: 'Erro interno no processamento'
      };
    }
  }
  
  /**
   * Executa o processamento automático para todas as organizações
   */
  async processAllOrganizations(): Promise<void> {
    try {
      console.log('[MessageCounter] Iniciando processamento para todas as organizações');
      
      // Buscar todas as organizações que têm mensagens pendentes
    const { data: messages, error } = await supabase
      .from('messages')
      .select('org_id')
      .eq('direction', 'outbound')
      .or('billing_status.is.null,billing_status.eq.' + BILLING.PENDING)

    if (error || !messages) {
      console.error('[MessageCounter] Erro ao buscar mensagens:', error);
      return;
    }

    // Extrair organizações únicas
    const orgIds = messages.map(msg => msg.org_id as string).filter(Boolean);
    const uniqueOrgs: string[] = Array.from(new Set(orgIds));
      
      if (uniqueOrgs.length === 0) {
      console.log('[MessageCounter] Nenhuma organização com mensagens pendentes encontrada');
      return;
    }
    console.log(`[MessageCounter] Processando ${uniqueOrgs.length} organizações`);
    
    let totalMessagesProcessed = 0;
    let totalCreditsDebited = 0;
    
    for (const orgId of uniqueOrgs) {
      console.log(`\n[MessageCounter] Processando org: ${orgId}`);
      const result = await this.processMessageCountAndDebit(orgId);
      
      if (result.success) {
        console.log(`✅ ${result.message}`);
        totalMessagesProcessed += result.messagesProcessed || 0;
        totalCreditsDebited += result.creditsDebited || 0;
      } else {
        console.log(`❌ ${result.message}`);
      }
    }

    console.log(`[MessageCounter] Processamento global concluído: ${uniqueOrgs.length} organizações processadas, ${totalMessagesProcessed} mensagens processadas, ${totalCreditsDebited} créditos debitados`);
    return;
      
    } catch (error) {
      console.error('[MessageCounter] Erro no processamento global:', error);
    }
  }
  
  /**
   * Obtém estatísticas de mensagens para uma organização
   */
  async getMessageStats(orgId: string): Promise<any> {
    try {
      const { data: stats, error } = await supabase
        .from('messages')
        .select('billing_status, direction, cost_credits, tokens_used')
        .eq('org_id', String(orgId));
      
      if (error || !stats) {
        return { error: 'Erro ao buscar estatísticas' };
      }
      
      const summary = {
        total: stats.length,
        pending: stats.filter(s => !s.billing_status || s.billing_status === BILLING.PENDING).length,
        debited: stats.filter(s => s.billing_status === BILLING.DEBITED).length,
        failed: stats.filter(s => s.billing_status === 'failed').length,
        skipped: stats.filter(s => s.billing_status === 'skipped').length,
        totalCreditsCharged: stats
          .filter(s => s.billing_status === BILLING.DEBITED)
          .reduce((sum, s) => sum + (s.cost_credits || 0), 0),
        totalTokensUsed: stats.reduce((sum, s) => sum + (s.tokens_used || 0), 0)
      };
      
      return summary;
      
    } catch (error) {
      console.error('[MessageCounter] Erro ao obter estatísticas:', error);
      return { error: 'Erro interno' };
    }
  }
}

// Instância singleton
export const messageCounterService = new MessageCounterService();