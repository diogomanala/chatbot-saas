import { billingService } from './billing.service';
import { calculateCreditCost, CREDIT_MESSAGES } from '../../packages/shared/pricing';

interface DebitContext {
  orgId: string;
  agentId: string;
  channel: 'web' | 'whatsapp';
  messageId?: string;
  meta?: Record<string, any>;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export class DebitInterceptor {
  /**
   * Pre-check if organization has sufficient credits before processing
   */
  static async preCheckCredits(
    orgId: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number = 1000 // Conservative estimate
  ): Promise<{ canProceed: boolean; message?: string }> {
    try {
      const estimatedCredits = calculateCreditCost(estimatedInputTokens, estimatedOutputTokens);
      const hasSufficientCredits = await billingService.hasSufficientCredits(orgId, estimatedCredits);
      
      if (!hasSufficientCredits) {
        console.warn('[DebitInterceptor] Insufficient credits for pre-check:', {
          orgId,
          estimatedCredits,
          estimatedInputTokens,
          estimatedOutputTokens
        });
        
        return {
          canProceed: false,
          message: CREDIT_MESSAGES.INSUFFICIENT_BALANCE
        };
      }
      
      return { canProceed: true };
    } catch (error) {
      console.error('[DebitInterceptor] Error in pre-check:', error);
      return {
        canProceed: false,
        message: 'Error checking credit balance'
      };
    }
  }

  /**
   * Post-process debit after LLM response is generated
   */
  static async postProcessDebit(
    context: DebitContext,
    tokenUsage: TokenUsage
  ): Promise<{ success: boolean; message: string; shouldSendResponse: boolean }> {
    try {
      const { orgId, agentId, channel, messageId, meta } = context;
      const { inputTokens, outputTokens } = tokenUsage;

      // Calculate credit cost based on tokens
      const creditCost = (inputTokens + outputTokens) * 0.001; // Example rate

      console.log('[DebitInterceptor] Processing debit:', {
        orgId,
        agentId,
        channel,
        inputTokens,
        outputTokens,
        creditCost,
        messageId
      });

      // Debit credits
      const result = await billingService.debitCredits({
        orgId,
        credits: creditCost,
        agentId,
        channel,
        messageId,
        inputTokens,
        outputTokens,
        metadata: meta
      });

      if (!result.success) {
        console.error('[DebitInterceptor] Debit failed:', result.message);
        return {
          success: false,
          message: result.message,
          shouldSendResponse: false // Don't send response if debit failed
        };
      }

      // Check if balance is now low and should trigger alerts
      const isLowBalance = await billingService.checkLowBalance(orgId);
      if (isLowBalance) {
        console.warn('[DebitInterceptor] Low balance detected for org:', orgId);
        // TODO: Trigger low balance alert (email, webhook, etc.)
      }

      return {
        success: true,
        message: result.message,
        shouldSendResponse: true
      };
    } catch (error) {
      console.error('[DebitInterceptor] Error in post-process debit:', error);
      return {
        success: false,
        message: 'Error processing credit debit',
        shouldSendResponse: false
      };
    }
  }

  /**
   * Wrapper function for LLM calls with automatic credit management
   */
  static async wrapLLMCall<T>(
    context: DebitContext,
    llmCall: () => Promise<{ response: T; tokenUsage: TokenUsage }>,
    preCheckTokens?: { inputTokens: number; estimatedOutputTokens?: number }
  ): Promise<{ success: boolean; response?: T; message: string }> {
    try {
      // Pre-check credits if token estimates provided
      if (preCheckTokens) {
        const preCheck = await DebitInterceptor.preCheckCredits(
          context.orgId,
          preCheckTokens.inputTokens,
          preCheckTokens.estimatedOutputTokens
        );
        
        if (!preCheck.canProceed) {
          return {
            success: false,
            message: preCheck.message || CREDIT_MESSAGES.INSUFFICIENT_BALANCE
          };
        }
      }

      // Execute LLM call
      const { response, tokenUsage } = await llmCall();

      // Post-process debit
      const debitResult = await DebitInterceptor.postProcessDebit(context, tokenUsage);
      
      if (!debitResult.shouldSendResponse) {
        return {
          success: false,
          message: debitResult.message
        };
      }

      return {
        success: true,
        response,
        message: debitResult.message
      };
    } catch (error) {
      console.error('[DebitInterceptor] Error in LLM call wrapper:', error);
      return {
        success: false,
        message: 'Error processing request'
      };
    }
  }

  /**
   * Utility function to extract token usage from different LLM providers
   */
  static extractTokenUsage(llmResponse: any, provider: 'openai' | 'groq' | 'anthropic' = 'openai'): TokenUsage {
    try {
      switch (provider) {
        case 'openai':
          return {
            inputTokens: llmResponse.usage?.prompt_tokens || 0,
            outputTokens: llmResponse.usage?.completion_tokens || 0
          };
        
        case 'groq':
          return {
            inputTokens: llmResponse.usage?.prompt_tokens || 0,
            outputTokens: llmResponse.usage?.completion_tokens || 0
          };
        
        case 'anthropic':
          return {
            inputTokens: llmResponse.usage?.input_tokens || 0,
            outputTokens: llmResponse.usage?.output_tokens || 0
          };
        
        default:
          console.warn('[DebitInterceptor] Unknown provider, using default token extraction');
          return {
            inputTokens: llmResponse.usage?.prompt_tokens || llmResponse.usage?.input_tokens || 0,
            outputTokens: llmResponse.usage?.completion_tokens || llmResponse.usage?.output_tokens || 0
          };
      }
    } catch (error) {
      console.error('[DebitInterceptor] Error extracting token usage:', error);
      return { inputTokens: 0, outputTokens: 0 };
    }
  }

  /**
   * Generate a unique message ID for idempotency
   */
  static generateMessageId(context: DebitContext, additionalData?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const base = `${context.orgId}-${context.agentId}-${timestamp}-${random}`;
    
    if (additionalData) {
      return `${base}-${additionalData}`;
    }
    
    return base;
  }
}

// Export singleton for convenience
export const debitInterceptor = DebitInterceptor;