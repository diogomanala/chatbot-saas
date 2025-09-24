-- Debug: Verificar status atual da constraint
-- 1) Verificar se a constraint existe e qual é sua definição
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'messages_billing_status_check';

-- 2) Verificar mensagens recentes (últimas 10)
SELECT 
    id,
    created_at,
    billing_status,
    tokens_used,
    direction,
    CASE 
        WHEN created_at > NOW() - INTERVAL '10 minutes' THEN '🔥 NOVA'
        WHEN created_at > NOW() - INTERVAL '1 hour' THEN '⚡ RECENTE'
        ELSE '📅 ANTIGA'
    END as age_status
FROM messages 
ORDER BY created_at DESC 
LIMIT 10;

-- 3) Contar mensagens por status nas últimas 2 horas
SELECT 
    billing_status,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM messages 
WHERE created_at > NOW() - INTERVAL '2 hours'
GROUP BY billing_status
ORDER BY billing_status;

-- 4) Verificar se há mensagens outbound pendentes recentes
SELECT 
    id,
    created_at,
    billing_status,
    tokens_used,
    direction
FROM messages 
WHERE direction = 'outbound' 
  AND billing_status = 'pending'
  AND created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;