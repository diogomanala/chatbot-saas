-- Verificar constraints existentes na tabela messages
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass;