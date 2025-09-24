-- Verificar políticas RLS na tabela messages
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd, 
    qual 
FROM pg_policies 
WHERE tablename = 'messages' 
ORDER BY policyname;