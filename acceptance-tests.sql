-- Checks de aceite para validar o sistema de billing
-- Execute no Supabase SQL Editor

-- 1) Últimas OUTBOUND para verificar se estão sendo processadas corretamente
SELECT id, created_at, billing_status, tokens_used
FROM messages 
WHERE direction='outbound' 
ORDER BY created_at DESC 
LIMIT 10;

-- 2) Distribuição por status para visão geral
SELECT billing_status, direction, COUNT(*) 
FROM messages 
GROUP BY 1,2 ORDER BY 1,2;

-- 3) Verificar se há mensagens pending recentes (últimas 24h)
SELECT COUNT(*) as pending_count
FROM messages 
WHERE direction='outbound' 
  AND billing_status='pending' 
  AND created_at > NOW() - INTERVAL '24 hours';

-- 4) Verificar se mensagens debited têm tokens_used >= 50
SELECT COUNT(*) as invalid_debited
FROM messages 
WHERE direction='outbound' 
  AND billing_status='debited' 
  AND COALESCE(tokens_used,0) < 50;

-- 5) Últimas 5 OUTBOUND - devem estar 100% debited
SELECT 
  id,
  created_at,
  billing_status,
  tokens_used,
  CASE 
    WHEN billing_status = 'debited' AND COALESCE(tokens_used,0) >= 50 THEN '✅ OK'
    ELSE '❌ PROBLEMA'
  END as status_check
FROM messages 
WHERE direction='outbound' 
ORDER BY created_at DESC 
LIMIT 5;