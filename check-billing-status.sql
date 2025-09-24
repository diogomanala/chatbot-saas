-- Verificar valores atuais de billing_status na tabela messages
SELECT DISTINCT billing_status, COUNT(*) as count
FROM messages 
GROUP BY billing_status 
ORDER BY billing_status;

-- Verificar valores que não estão na constraint permitida
SELECT DISTINCT billing_status, COUNT(*) as count
FROM messages 
WHERE billing_status NOT IN ('pending','debited','no_charge','refused_insufficient_balance','errored')
GROUP BY billing_status;

-- Mostrar algumas linhas com valores inválidos
SELECT id, direction, billing_status, tokens_used, created_at
FROM messages 
WHERE billing_status NOT IN ('pending','debited','no_charge','refused_insufficient_balance','errored')
LIMIT 10;