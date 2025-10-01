/**
 * SISTEMA SIMPLIFICADO DE COBRANÇA
 * 
 * Estratégia: Débito direto na inserção da mensagem
 * - Calcula tokens baseado no conteúdo
 * - Converte para créditos (1000 tokens = 1 crédito)
 * - Debita diretamente da tabela organization_credits
 * - Atualiza a mensagem com status final
 */

import { createClient } from '@supabase/supabase-js';
import { MIN_CHARGE_TOKENS } from './billing-consts';

// Cliente Supabase com service role para operações de backend
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface SimplifiedBillingOptions {
  messageId: string;
  orgId: string;
  messageContent: string;
  tokensUsed?: number;
}

interface BillingResult {
  success: boolean;
  message: string;
  tokensCalculated: number;
  creditsDebited: number;
  balanceAfter: number;
}

export class SimplifiedBillingService {
  
  /**
   * Calcula tokens baseado no conteúdo da mensagem
   */
  private static calculateTokens(content: string, providedTokens?: number): number {
    if (providedTokens && providedTokens > 0) {
      return Math.max(providedTokens, MIN_CHARGE_TOKENS);
    }
    
    // Fórmula simples: ~4 caracteres por token + overhead mínimo
    const estimatedTokens = Math.ceil(content.length / 4) + 50;
    return Math.max(estimatedTokens, MIN_CHARGE_TOKENS);
  }

  /**
   * Converte tokens para créditos
   */
  private static calculateCredits(tokens: number): number {
    // 1000 tokens = 1 crédito (mínimo 1 crédito)
    return Math.max(Math.ceil(tokens / 1000), 1);
  }

  /**
   * Processa cobrança simplificada
   */
  static async processSimplifiedBilling(options: SimplifiedBillingOptions): Promise<BillingResult> {
    const { messageId, orgId, messageContent, tokensUsed } = options;

    try {
      console.log(`[SimplifiedBilling] 🚀 Iniciando cobrança para mensagem ${messageId}`);

      // 1. Calcular tokens
      const calculatedTokens = this.calculateTokens(messageContent, tokensUsed);
      const creditsToDebit = this.calculateCredits(calculatedTokens);

      console.log(`[SimplifiedBilling] 📊 Tokens: ${calculatedTokens}, Créditos: ${creditsToDebit}`);

      // 2. Verificar saldo atual
      const { data: orgCredits, error: balanceError } = await supabase
        .from('organization_credits')
        .select('balance')
        .eq('org_id', orgId)
        .single();

      if (balanceError || !orgCredits) {
        console.error('[SimplifiedBilling] ❌ Erro ao verificar saldo:', balanceError);
        return {
          success: false,
          message: 'Erro ao verificar saldo da organização',
          tokensCalculated: calculatedTokens,
          creditsDebited: 0,
          balanceAfter: 0
        };
      }

      const currentBalance = orgCredits.balance;
      console.log(`[SimplifiedBilling] 💰 Saldo atual: ${currentBalance}`);

      // 3. Verificar se há saldo suficiente
      if (currentBalance < creditsToDebit) {
        console.log(`[SimplifiedBilling] ⚠️ Saldo insuficiente: ${currentBalance} < ${creditsToDebit}`);
        
        // Atualizar mensagem como failed
        await supabase
          .from('messages')
          .update({
            tokens_used: calculatedTokens,
            billing_status: 'failed',
            charged_at: new Date().toISOString()
          })
          .eq('id', messageId);

        return {
          success: false,
          message: `Saldo insuficiente. Necessário: ${creditsToDebit}, Disponível: ${currentBalance}`,
          tokensCalculated: calculatedTokens,
          creditsDebited: 0,
          balanceAfter: currentBalance
        };
      }

      // 4. Debitar créditos diretamente
      const newBalance = currentBalance - creditsToDebit;
      
      const { error: debitError } = await supabase
        .from('organization_credits')
        .update({ 
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId);

      if (debitError) {
        console.error('[SimplifiedBilling] ❌ Erro ao debitar créditos:', debitError);
        return {
          success: false,
          message: 'Erro ao debitar créditos',
          tokensCalculated: calculatedTokens,
          creditsDebited: 0,
          balanceAfter: currentBalance
        };
      }

      // 5. Atualizar mensagem como debitada
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          tokens_used: calculatedTokens,
          billing_status: 'debited',
          charged_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (updateError) {
        console.error('[SimplifiedBilling] ⚠️ Erro ao atualizar mensagem (débito já realizado):', updateError);
        // Não falha aqui pois o débito já foi feito
      }

      console.log(`[SimplifiedBilling] ✅ COBRANÇA REALIZADA:`);
      console.log(`[SimplifiedBilling]    Message ID: ${messageId}`);
      console.log(`[SimplifiedBilling]    Org ID: ${orgId}`);
      console.log(`[SimplifiedBilling]    Tokens: ${calculatedTokens}`);
      console.log(`[SimplifiedBilling]    Créditos debitados: ${creditsToDebit}`);
      console.log(`[SimplifiedBilling]    Saldo antes: ${currentBalance}`);
      console.log(`[SimplifiedBilling]    Saldo depois: ${newBalance}`);

      return {
        success: true,
        message: 'Cobrança simplificada realizada com sucesso',
        tokensCalculated: calculatedTokens,
        creditsDebited: creditsToDebit,
        balanceAfter: newBalance
      };

    } catch (error) {
      console.error('[SimplifiedBilling] ❌ Erro no processamento:', error);
      return {
        success: false,
        message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        tokensCalculated: 0,
        creditsDebited: 0,
        balanceAfter: 0
      };
    }
  }

  /**
   * Processa cobrança com inserção da mensagem em uma única operação
   */
  static async insertMessageWithBilling(
    messageData: any,
    orgId: string,
    messageContent: string,
    tokensUsed?: number
  ): Promise<{ success: boolean; message?: any; billing?: BillingResult }> {
    try {
      // 1. Inserir mensagem primeiro
      const { data: insertedMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          ...messageData,
          content: messageContent, // ✅ Garantir que o campo content seja preenchido
          message_content: messageContent, // ✅ Garantir que o campo message_content seja preenchido
          billing_status: 'pending' // Inicia como pending
        })
        .select('*')
        .single();

      if (insertError || !insertedMessage) {
        console.error('[SimplifiedBilling] ❌ Erro ao inserir mensagem:', insertError);
        return { success: false };
      }

      // 2. Processar cobrança imediatamente
      const billingResult = await this.processSimplifiedBilling({
        messageId: insertedMessage.id,
        orgId,
        messageContent,
        tokensUsed
      });

      return {
        success: billingResult.success,
        message: insertedMessage,
        billing: billingResult
      };

    } catch (error) {
      console.error('[SimplifiedBilling] ❌ Erro na inserção com cobrança:', error);
      return { success: false };
    }
  }
}

export const simplifiedBillingService = SimplifiedBillingService;