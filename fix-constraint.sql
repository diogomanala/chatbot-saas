-- Remover a constraint atual que está causando erro
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_billing_status_allowed_ck;

-- Criar nova constraint com todos os valores válidos encontrados no código
ALTER TABLE messages
  ADD CONSTRAINT messages_billing_status_allowed_ck
  CHECK (billing_status IN (
    'pending',
    'debited', 
    'no_charge',
    'refused_insufficient_balance',
    'errored',
    'charged',    -- valor legado encontrado no código
    'skipped',    -- valor legado encontrado no código  
    'failed'      -- valor legado encontrado no código
  ));

-- Verificar se a constraint foi aplicada com sucesso
SELECT DISTINCT billing_status, COUNT(*) as count
FROM messages 
GROUP BY billing_status 
ORDER BY billing_status;