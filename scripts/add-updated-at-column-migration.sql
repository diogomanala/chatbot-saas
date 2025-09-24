-- Migração: Adicionar coluna updated_at na tabela devices
-- Execute este script no SQL Editor do Supabase
-- Data: 2025-01-24
-- Descrição: Adiciona coluna updated_at com trigger automático para auditoria de alterações

BEGIN;

-- 1. Adicionar a coluna updated_at na tabela devices
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Atualizar registros existentes com o valor de created_at
UPDATE public.devices 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 3. Criar função para atualizar automaticamente o updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para atualizar automaticamente updated_at em UPDATEs
DROP TRIGGER IF EXISTS trigger_update_devices_updated_at ON public.devices;

CREATE TRIGGER trigger_update_devices_updated_at
    BEFORE UPDATE ON public.devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Criar índice para performance em consultas por updated_at
CREATE INDEX IF NOT EXISTS idx_devices_updated_at ON public.devices(updated_at);

-- 6. Adicionar comentário explicativo na coluna
COMMENT ON COLUMN public.devices.updated_at IS 'Timestamp automático de última atualização do registro';

-- 7. Verificar se a migração foi aplicada corretamente
DO $$
BEGIN
    -- Verificar se a coluna foi criada
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'devices' 
        AND column_name = 'updated_at'
    ) THEN
        RAISE NOTICE '✅ Coluna updated_at criada com sucesso na tabela devices';
    ELSE
        RAISE EXCEPTION '❌ Falha ao criar coluna updated_at na tabela devices';
    END IF;
    
    -- Verificar se o trigger foi criado
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_schema = 'public' 
        AND event_object_table = 'devices' 
        AND trigger_name = 'trigger_update_devices_updated_at'
    ) THEN
        RAISE NOTICE '✅ Trigger de updated_at criado com sucesso';
    ELSE
        RAISE EXCEPTION '❌ Falha ao criar trigger de updated_at';
    END IF;
    
    -- Verificar se o índice foi criado
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'devices' 
        AND indexname = 'idx_devices_updated_at'
    ) THEN
        RAISE NOTICE '✅ Índice idx_devices_updated_at criado com sucesso';
    ELSE
        RAISE EXCEPTION '❌ Falha ao criar índice idx_devices_updated_at';
    END IF;
END $$;

COMMIT;

-- 8. Instruções pós-migração
/*
INSTRUÇÕES PARA APLICAR ESTA MIGRAÇÃO:

1. Acesse o painel do Supabase (https://supabase.com/dashboard)
2. Vá para o seu projeto
3. Navegue até "SQL Editor"
4. Cole todo o conteúdo deste arquivo
5. Execute o script clicando em "Run"

VERIFICAÇÃO PÓS-MIGRAÇÃO:
- A coluna updated_at deve aparecer na tabela devices
- O trigger deve atualizar automaticamente updated_at em cada UPDATE
- Registros existentes devem ter updated_at = created_at inicialmente

TESTE RÁPIDO:
UPDATE devices SET name = name WHERE id = (SELECT id FROM devices LIMIT 1);
-- O updated_at deve ser atualizado automaticamente para NOW()
*/