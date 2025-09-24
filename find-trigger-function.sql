-- Query to find the function executed by the messages_outbound_autodebit_ai trigger
SELECT 
    t.tgname AS trigger_name,
    p.proname AS function_name,
    n.nspname AS schema_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE t.tgname = 'messages_outbound_autodebit_ai';