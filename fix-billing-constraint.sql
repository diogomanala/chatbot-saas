-- Corrigir constraint billing_status_check para incluir 'debited'
-- Execute no Supabase SQL Editor

-- 1) Remover constraint antiga
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_billing_status_check;

-- 2) Adicionar nova constraint com 'debited' incluído
ALTER TABLE messages 
ADD CONSTRAINT messages_billing_status_check 
CHECK (billing_status IN ('pending', 'charged', 'failed', 'skipped', 'debited', 'no_charge'));

-- 3) Verificar se a constraint foi criada corretamente
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'messages_billing_status_check';