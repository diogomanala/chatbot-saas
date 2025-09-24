-- =====================================================
-- MIGRAÇÃO PARA SISTEMA DE COBRANÇA SIMPLIFICADO
-- =====================================================
-- Execute este script para migrar dados existentes
-- =====================================================

-- 1. LIMPEZA DE DADOS EXISTENTES
-- Atualizar mensagens inbound para o novo sistema
UPDATE messages 
SET billing_status = 'no_charge',
    tokens_used = 0,
    cost_credits = 0
WHERE direction = 'inbound';

-- Atualizar mensagens outbound para o novo sistema
UPDATE messages 
SET billing_status = 'debited',
    tokens_used = 1,
    cost_credits = 1,
    charged_at = COALESCE(charged_at, created_at)
WHERE direction = 'outbound' 
  AND billing_status IN ('pending', 'charged', 'skipped', 'failed');

-- Mensagens outbound com erro mantêm status 'errored'
UPDATE messages 
SET tokens_used = 1,
    cost_credits = 1
WHERE direction = 'outbound' 
  AND billing_status = 'errored';

-- 2. VERIFICAÇÃO FINAL
SELECT 
  billing_status,
  direction,
  COUNT(*) as total,
  AVG(tokens_used) as avg_tokens,
  AVG(cost_credits) as avg_credits
FROM messages 
GROUP BY billing_status, direction 
ORDER BY billing_status, direction;

-- 3. VERIFICAR CONSTRAINTS
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
  AND conname LIKE '%billing%';