-- Hotfix imediato dos dados existentes

-- charged -> debited
UPDATE messages SET billing_status='debited'
WHERE direction='outbound' AND billing_status='charged';

-- inbound skipped -> no_charge
UPDATE messages SET billing_status='no_charge', tokens_used=COALESCE(tokens_used,0)
WHERE direction='inbound' AND billing_status='skipped';

-- outbound pending/skipped com estimativa -> debitar mínimo
UPDATE messages
SET tokens_used    = GREATEST(COALESCE(tokens_used,0), COALESCE(tokens_estimated,0), 50),
    billing_status = 'debited',
    billed_at      = NOW()
WHERE direction='outbound'
  AND billing_status IN ('pending','skipped')
  AND COALESCE(tokens_estimated,0) > 0;

-- debited com 0 tokens -> corrige
UPDATE messages SET tokens_used = 50
WHERE direction='outbound' AND billing_status='debited' AND COALESCE(tokens_used,0)=0;