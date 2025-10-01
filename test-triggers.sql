-- Teste rápido (SQL)
-- simula um insert OUTBOUND "pending"
INSERT INTO messages (org_id, direction, phone_number, message_content, billing_status, tokens_estimated)
VALUES ('<ORG_ID>', 'outbound', '5599999999999', 'teste', 'pending', 63)
RETURNING id;

-- deve sair já debited com tokens_used >= 50
SELECT id, billing_status, tokens_estimated, tokens_used
FROM messages
ORDER BY created_at DESC
LIMIT 3;

-- Verificar banco e schema atual
SELECT current_database(), current_schema();