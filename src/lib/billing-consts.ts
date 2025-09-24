export const BILLING = {
  PENDING: 'pending',
  DEBITED: 'debited',
  REFUSED: 'refused_insufficient_balance',
  ERRORED: 'errored',
} as const;

export const DELIVERY = {
  QUEUED: 'queued',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETRYING: 'retrying',
} as const;

export const MIN_CHARGE_TOKENS = 50; // piso mínimo para cobrança

export type BillingStatus = typeof BILLING[keyof typeof BILLING];
export type DeliveryStatus = typeof DELIVERY[keyof typeof DELIVERY];