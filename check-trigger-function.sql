-- Verificar se a função simple_debit_credits existe
SELECT proname, pronargs, pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'simple_debit_credits';

-- Verificar se o trigger existe
SELECT tgname, tgfoid::regproc as function_name
FROM pg_trigger 
WHERE tgrelid = 'messages'::regclass;