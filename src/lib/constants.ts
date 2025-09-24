/**
 * Constants for the billing system
 */

// Credit-related messages
export const CREDIT_MESSAGES = {
  INSUFFICIENT_CREDITS: 'Créditos insuficientes para processar esta mensagem',
  LOW_BALANCE_WARNING: 'Seu saldo de créditos está baixo',
  CREDITS_DEPLETED: 'Seus créditos foram esgotados',
  TOP_UP_SUCCESS: 'Créditos adicionados com sucesso',
  DEBIT_SUCCESS: 'Créditos debitados com sucesso',
  USAGE_RECORDED: 'Uso registrado com sucesso'
} as const;

// Billing configuration
export const BILLING_CONFIG = {
  TOKENS_PER_CREDIT: 1000,
  LOW_BALANCE_THRESHOLD: 100,
  ALERT_THRESHOLDS: [50, 100, 200],
  MAX_RETRY_ATTEMPTS: 3
} as const;

// Event types
export const EVENT_TYPES = {
  MESSAGE_PROCESSED: 'message_processed',
  CREDITS_TOPPED_UP: 'credits_topped_up',
  LOW_BALANCE_ALERT: 'low_balance_alert',
  INSUFFICIENT_CREDITS: 'insufficient_credits'
} as const;

// Error messages
export const ERROR_MESSAGES = {
  WALLET_NOT_FOUND: 'Carteira de créditos não encontrada',
  INVALID_AMOUNT: 'Quantidade inválida',
  DATABASE_ERROR: 'Erro no banco de dados',
  NETWORK_ERROR: 'Erro de conexão',
  UNAUTHORIZED: 'Não autorizado'
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  CREDITS_ADDED: 'Créditos adicionados com sucesso',
  USAGE_RECORDED: 'Uso registrado com sucesso',
  ALERT_CREATED: 'Alerta criado com sucesso'
} as const;