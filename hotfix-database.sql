-- Hotfix rápido de dados para normalizar billing_status
-- Execute no Supabase SQL Editor

-- 1) charged -> debited
UPDATE messages SET billing_status='debited' 
WHERE direction='outbound' AND billing_status='charged';

-- 2) inbound skipped -> no_charge
UPDATE messages SET billing_status='no_charge', tokens_used=COALESCE(tokens_used,0) 
WHERE direction='inbound' AND billing_status='skipped';

-- 3) outbound skipped -> debitar mínimo de 50 tokens
UPDATE messages 
SET tokens_used=GREATEST(COALESCE(tokens_used,0), 50), 
    billing_status='debited'
WHERE direction='outbound' AND billing_status='skipped';

-- 4) sanidade: nunca 'debited' com tokens 0
UPDATE messages SET tokens_used=50 
WHERE direction='outbound' AND billing_status='debited' AND COALESCE(tokens_used,0)=0;

-- Verificação final
SELECT billing_status, direction, COUNT(*) 
FROM messages 
GROUP BY 1,2 ORDER BY 1,2;