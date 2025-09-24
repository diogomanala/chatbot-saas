// Pricing configuration and types for the credit system

// Business plan configuration
export const TOKENS_PER_CREDIT = 1000;
export const LOW_BALANCE_THRESHOLD = 0.2; // 20%

// Credit wallet type for organizations
export interface CreditWallet {
  orgId: string;
  balance: number;
  currency: 'BRL';
  updatedAt: Date;
}

// Usage event type for tracking token consumption
export interface UsageEvent {
  id: string;
  orgId: string;
  agentId: string;
  channel: 'web' | 'whatsapp';
  inputTokens: number;
  outputTokens: number;
  costCredits: number;
  createdAt: Date;
  messageId?: string;
  meta?: Record<string, any>;
}

// Top-up event type for manual credit additions by super admin
export interface TopUpEvent {
  id: string;
  orgId: string;
  addedCredits: number;
  reason?: string;
  performedByUserId: string;
  createdAt: Date;
}

// Helper function to calculate credit cost from tokens
export function calculateCreditCost(inputTokens: number, outputTokens: number): number {
  const totalTokens = inputTokens + outputTokens;
  return Math.ceil(totalTokens / TOKENS_PER_CREDIT);
}

// Helper function to check if balance is low
export function isBalanceLow(balance: number, threshold: number = 100): boolean {
  return balance < (threshold * LOW_BALANCE_THRESHOLD);
}

// Credit system messages
export const CREDIT_MESSAGES = {
  INSUFFICIENT_BALANCE: '⚠️ Saldo de créditos esgotado. Recarregue para continuar.',
  LOW_BALANCE_WARNING: '⚠️ Saldo de créditos baixo. Considere recarregar em breve.',
  TOP_UP_SUCCESS: '✅ Créditos adicionados com sucesso.',
  DEBIT_SUCCESS: '✅ Créditos debitados com sucesso.',
} as const;

// Export types for database operations
export type CreditWalletInsert = Omit<CreditWallet, 'updatedAt'> & {
  updatedAt?: Date;
};

export type UsageEventInsert = Omit<UsageEvent, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: Date;
};

export type TopUpEventInsert = Omit<TopUpEvent, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: Date;
};