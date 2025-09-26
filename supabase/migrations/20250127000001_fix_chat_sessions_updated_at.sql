-- =====================================================================
-- Migração: Correção da Tabela chat_sessions - Adicionar updated_at
-- Data: 2025-01-27
-- Descrição: Adiciona a coluna updated_at ausente na tabela chat_sessions
--           e corrige constraints para o Flow Builder
-- =====================================================================

-- =====================================================================
-- 1. ADICIONAR COLUNA UPDATED_AT À TABELA CHAT_SESSIONS
-- =====================================================================

-- Adicionar coluna updated_at se não existir
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- =====================================================================
-- 2. ADICIONAR COLUNA PHONE_NUMBER SE NÃO EXISTIR
-- =====================================================================

-- Verificar se a coluna phone_number existe, se não, adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'chat_sessions' 
        AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE public.chat_sessions 
        ADD COLUMN phone_number text NOT NULL DEFAULT '';
        
        -- Atualizar valores existentes se houver dados
        UPDATE public.chat_sessions 
        SET phone_number = COALESCE(sender_phone, '') 
        WHERE phone_number = '';
    END IF;
END $$;

-- =====================================================================
-- 3. ADICIONAR CONSTRAINTS DE VALIDAÇÃO SE NÃO EXISTIREM
-- =====================================================================

-- Constraint para phone_number format
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_sessions_phone_format' 
        AND table_name = 'chat_sessions'
    ) THEN
        ALTER TABLE public.chat_sessions 
        ADD CONSTRAINT chat_sessions_phone_format 
        CHECK (phone_number ~ '^[0-9+\-\s()]*$');
    END IF;
END $$;

-- Constraint para current_step_valid
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_sessions_current_step_valid' 
        AND table_name = 'chat_sessions'
    ) THEN
        ALTER TABLE public.chat_sessions 
        ADD CONSTRAINT chat_sessions_current_step_valid 
        CHECK (
            (active_flow_id IS NULL AND current_step_id IS NULL) OR 
            (active_flow_id IS NOT NULL)
        );
    END IF;
END $$;

-- =====================================================================
-- 4. CRIAR TRIGGER PARA UPDATED_AT SE NÃO EXISTIR
-- =====================================================================

-- Verificar se o trigger já existe, se não, criar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_chat_sessions_updated_at' 
        AND event_object_table = 'chat_sessions'
    ) THEN
        CREATE TRIGGER update_chat_sessions_updated_at 
            BEFORE UPDATE ON public.chat_sessions 
            FOR EACH ROW 
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- =====================================================================
-- 5. ADICIONAR ÍNDICES OTIMIZADOS SE NÃO EXISTIREM
-- =====================================================================

-- Índice para phone_number
CREATE INDEX IF NOT EXISTS idx_chat_sessions_phone_number 
ON public.chat_sessions(phone_number);

-- Índice composto para org_id e phone_number
CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_phone 
ON public.chat_sessions(org_id, phone_number);

-- Índice composto para chatbot_id e phone_number
CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot_phone 
ON public.chat_sessions(chatbot_id, phone_number);

-- Índice para sessões ativas
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active_sessions 
ON public.chat_sessions(org_id, status) WHERE status = 'active';

-- Índice para created_at
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at 
ON public.chat_sessions(created_at DESC);

-- =====================================================================
-- 6. ATUALIZAR COMENTÁRIOS DA TABELA
-- =====================================================================

-- Comentários atualizados
COMMENT ON COLUMN public.chat_sessions.phone_number IS 'Número de telefone do usuário (formato internacional)';
COMMENT ON COLUMN public.chat_sessions.updated_at IS 'Timestamp da última atualização (mantido automaticamente)';

-- =====================================================================
-- 7. VALIDAÇÕES FINAIS
-- =====================================================================

-- Atualizar estatísticas da tabela
ANALYZE public.chat_sessions;

-- =====================================================================
-- MIGRAÇÃO DE CORREÇÃO CONCLUÍDA
-- =====================================================================
-- 
-- Esta migração corrige:
-- ✅ Adiciona coluna updated_at ausente
-- ✅ Adiciona coluna phone_number se necessário
-- ✅ Adiciona constraints de validação
-- ✅ Cria trigger para updated_at
-- ✅ Adiciona índices otimizados
-- ✅ Atualiza documentação
-- 
-- A tabela chat_sessions agora está completa para o Flow Builder!
-- =====================================================================