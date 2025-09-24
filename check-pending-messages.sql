-- Verificar mensagens pendentes
SELECT 
  id,
  direction,
  sender_phone,
  receiver_phone,
  LEFT(COALESCE(message_content, content, ''), 50) as content_preview,
  tokens_used,
  billing_status,
  cost_credits,
  created_at,
  charged_at
FROM messages 
WHERE billing_status = 'pending'
ORDER BY created_at DESC
LIMIT 10;

-- Estatísticas de billing_status
SELECT 
  billing_status,
  COUNT(*) as count,
  SUM(COALESCE(tokens_used, 0)) as total_tokens,
  SUM(COALESCE(cost_credits, 0)) as total_credits
FROM messages 
GROUP BY billing_status
ORDER BY count DESC;

-- Verificar saldos das carteiras
SELECT 
  org_id,
  balance,
  created_at,
  updated_at
FROM credit_wallets
ORDER BY balance DESC;