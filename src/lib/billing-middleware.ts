import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface BillingResult {
  success: boolean;
  error?: string;
  billing_id?: string;
  tokens_used?: number;
  credits_charged?: number;
  previous_balance?: number;
  new_balance?: number;
  current_balance?: number;
  required?: number;
}

export interface BillingOptions {
  org_id: string;
  content: string;
  message_id?: string;
  skip_if_insufficient?: boolean;
  auto_generate_message_id?: boolean;
}

/**
 * Middleware de cobrança para processar automaticamente o custo das mensagens
 */
export class BillingMiddleware {
  /**
   * Processa a cobrança de uma mensagem
   */
  static async processCharge(options: BillingOptions): Promise<BillingResult> {
    try {
      const { org_id, content, message_id, skip_if_insufficient = false, auto_generate_message_id = true } = options;

      // Gerar message_id se não fornecido
      let finalMessageId = message_id;
      if (!finalMessageId && auto_generate_message_id) {
        finalMessageId = crypto.randomUUID();
      }

      if (!finalMessageId) {
        return {
          success: false,
          error: 'message_id é obrigatório ou auto_generate_message_id deve ser true'
        };
      }

      console.log(`[BillingMiddleware] Processando cobrança - Org: ${org_id}, Message: ${finalMessageId}`);

      // Usar a função SQL process_message_billing
      const { data, error } = await supabase.rpc('process_message_billing', {
        p_message_id: finalMessageId,
        p_org_id: org_id,
        p_content: content
      });

      if (error) {
        console.error('[BillingMiddleware] Erro na função SQL:', error);
        return {
          success: false,
          error: `Erro ao processar cobrança: ${error.message}`
        };
      }

      const result = data as BillingResult;
      
      if (!result.success) {
        console.log(`[BillingMiddleware] Cobrança falhou: ${result.error}`);
        
        // Se configurado para pular quando insuficiente, retorna sucesso mas sem cobrança
        if (skip_if_insufficient && result.error === 'Insufficient credits') {
          return {
            success: true,
            error: 'Skipped due to insufficient credits',
            current_balance: result.current_balance,
            required: result.required
          };
        }
        
        return result;
      }

      console.log(`[BillingMiddleware] Cobrança processada:`, {
        billing_id: result.billing_id,
        tokens_used: result.tokens_used,
        credits_charged: result.credits_charged,
        new_balance: result.new_balance
      });

      return result;

    } catch (error) {
      console.error('[BillingMiddleware] Erro interno:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno'
      };
    }
  }

  /**
   * Verifica se uma organização tem saldo suficiente para uma operação
   */
  static async checkBalance(org_id: string, estimated_content?: string): Promise<{
    has_sufficient_balance: boolean;
    current_balance: number;
    estimated_cost?: number;
    estimated_tokens?: number;
  }> {
    try {
      // Obter estatísticas da organização
      const { data, error } = await supabase.rpc('get_billing_stats', {
        p_org_id: org_id
      });

      if (error) {
        console.error('[BillingMiddleware] Erro ao verificar saldo:', error);
        return {
          has_sufficient_balance: false,
          current_balance: 0
        };
      }

      const stats = data;
      const current_balance = stats.current_balance || 0;

      // Se conteúdo fornecido, estimar custo
      if (estimated_content) {
        const estimated_tokens = Math.ceil(estimated_content.length / 4);
        const estimated_cost = estimated_tokens * 0.001;
        
        return {
          has_sufficient_balance: current_balance >= estimated_cost,
          current_balance,
          estimated_cost,
          estimated_tokens
        };
      }

      return {
        has_sufficient_balance: current_balance > 0,
        current_balance
      };

    } catch (error) {
      console.error('[BillingMiddleware] Erro ao verificar saldo:', error);
      return {
        has_sufficient_balance: false,
        current_balance: 0
      };
    }
  }

  /**
   * Middleware para Express/Next.js que verifica saldo antes de processar
   */
  static createBalanceCheckMiddleware(options: {
    getOrgId: (req: any) => string;
    getContent?: (req: any) => string;
    onInsufficientBalance?: (req: any, res: any, balance_info: any) => void;
  }) {
    return async (req: any, res: any, next: any) => {
      try {
        const org_id = options.getOrgId(req);
        const content = options.getContent ? options.getContent(req) : undefined;

        const balance_info = await BillingMiddleware.checkBalance(org_id, content);

        if (!balance_info.has_sufficient_balance) {
          console.log(`[BillingMiddleware] Saldo insuficiente para org: ${org_id}`);
          
          if (options.onInsufficientBalance) {
            return options.onInsufficientBalance(req, res, balance_info);
          }
          
          return res.status(402).json({
            error: 'Insufficient credits',
            current_balance: balance_info.current_balance,
            estimated_cost: balance_info.estimated_cost
          });
        }

        // Adicionar informações de saldo ao request
        req.billing_info = balance_info;
        next();

      } catch (error) {
        console.error('[BillingMiddleware] Erro no middleware:', error);
        return res.status(500).json({
          error: 'Internal server error in billing middleware'
        });
      }
    };
  }

  /**
   * Processa cobrança após uma operação bem-sucedida
   */
  static async chargeAfterSuccess(options: {
    org_id: string;
    content: string;
    message_id?: string;
    operation_result: any;
  }): Promise<{ operation_result: any; billing_result: BillingResult }> {
    const billing_result = await BillingMiddleware.processCharge({
      org_id: options.org_id,
      content: options.content,
      message_id: options.message_id,
      skip_if_insufficient: false
    });

    return {
      operation_result: options.operation_result,
      billing_result
    };
  }
}

/**
 * Utilitários para integração rápida
 */
export const BillingUtils = {
  /**
   * Wrapper para funções que precisam de cobrança automática
   */
  withBilling: <T>(fn: (args: any) => Promise<T>) => {
    return async (args: any & { org_id: string; content: string; message_id?: string }): Promise<{
      result: T;
      billing: BillingResult;
    }> => {
      // Executar função original
      const result = await fn(args);
      
      // Processar cobrança
      const billing = await BillingMiddleware.processCharge({
        org_id: args.org_id,
        content: args.content,
        message_id: args.message_id
      });
      
      return { result, billing };
    };
  },

  /**
   * Estima o custo de uma operação sem executá-la
   */
  estimateCost: (content: string): { tokens: number; credits: number } => {
    const tokens = Math.ceil(content.length / 4);
    const credits = tokens * 0.001;
    return { tokens, credits };
  }
};