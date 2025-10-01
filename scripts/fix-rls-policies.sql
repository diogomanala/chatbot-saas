-- Script para corrigir as políticas RLS da tabela system_alerts
-- Execute este script no Supabase SQL Editor após executar o recreate-system-alerts-table.sql

-- Remover políticas existentes
DROP POLICY IF EXISTS "Allow full access with service role" ON public.system_alerts;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.system_alerts;

-- Criar política mais permissiva para service_role (permite tudo)
CREATE POLICY "Service role full access" ON public.system_alerts
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Criar política para authenticated users (leitura e escrita)
CREATE POLICY "Authenticated users full access" ON public.system_alerts
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Criar política para anon users (apenas leitura)
CREATE POLICY "Anonymous users read only" ON public.system_alerts
    FOR SELECT 
    TO anon
    USING (true);

-- Verificar as políticas criadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'system_alerts';

-- Testar inserção direta
INSERT INTO public.system_alerts (type, severity, title, message, source, metadata) VALUES
('info', 'low', 'Teste RLS', 'Testando se as políticas RLS estão funcionando', 'rls_test', '{"test": "rls_fix"}');

-- Verificar se a inserção funcionou
SELECT COUNT(*) as total_alerts FROM public.system_alerts;

COMMIT;

-- IMPORTANTE: Execute este script após o recreate-system-alerts-table.sql
-- para corrigir as políticas de segurança e permitir inserções.