-- Remover constraint existente primeiro (se existir)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_billing_status_allowed_ck;

-- Criar nova constraint com todos os valores válidos
ALTER TABLE messages
  ADD CONSTRAINT messages_billing_status_allowed_ck
  CHECK (billing_status IN (
    'pending',
    'debited', 
    'no_charge',
    'refused_insufficient_balance',
    'errored',
    'charged',    -- valor legado
    'skipped',    -- valor legado  
    'failed'      -- valor legado
  ));

-- Verificar se funcionou
SELECT 
  conname as constraint_name,
  consrc as constraint_definition
FROM pg_constraint 
WHERE conname = 'messages_billing_status_allowed_ck';