-- Script para RECRIAR completamente a tabela system_alerts
-- Execute este script no Supabase SQL Editor para resolver problemas de cache

-- PRIMEIRO: Remover a tabela existente (se houver)
DROP TABLE IF EXISTS public.system_alerts CASCADE;

-- SEGUNDO: Remover função se existir
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- TERCEIRO: Criar a tabela system_alerts com estrutura correta
CREATE TABLE public.system_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type VARCHAR(50) NOT NULL CHECK (type IN ('critical', 'warning', 'info', 'success')),
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'system',
    correlation_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Criar índices para melhor performance
CREATE INDEX idx_system_alerts_type ON public.system_alerts(type);
CREATE INDEX idx_system_alerts_severity ON public.system_alerts(severity);
CREATE INDEX idx_system_alerts_resolved ON public.system_alerts(resolved);
CREATE INDEX idx_system_alerts_created_at ON public.system_alerts(created_at DESC);
CREATE INDEX idx_system_alerts_correlation_id ON public.system_alerts(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_system_alerts_source ON public.system_alerts(source);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_system_alerts_updated_at
    BEFORE UPDATE ON public.system_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir acesso total com service role
CREATE POLICY "Allow full access with service role" ON public.system_alerts
    FOR ALL USING (auth.role() = 'service_role');

-- Criar política para leitura com authenticated users
CREATE POLICY "Allow read access for authenticated users" ON public.system_alerts
    FOR SELECT USING (auth.role() = 'authenticated');

-- Inserir alguns alertas de exemplo para teste
INSERT INTO public.system_alerts (type, severity, title, message, source, metadata) VALUES
('info', 'low', 'Sistema Inicializado', 'Sistema de alertas foi configurado com sucesso', 'system', '{"version": "1.0.0"}'),
('warning', 'medium', 'Teste de Alerta', 'Este é um alerta de teste para verificar o funcionamento', 'test', '{"test": true}'),
('critical', 'critical', 'Alerta Crítico de Teste', 'Este é um alerta crítico para testar a interface', 'test', '{"priority": "high"}');

-- Verificar se a tabela foi criada corretamente
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'system_alerts'
ORDER BY ordinal_position;

-- Verificar os alertas inseridos
SELECT 
    id,
    type,
    severity,
    title,
    message,
    resolved,
    created_at
FROM public.system_alerts
ORDER BY created_at DESC;

COMMIT;

-- IMPORTANTE: Após executar este script, aguarde alguns minutos
-- para que o cache do Supabase seja atualizado completamente.