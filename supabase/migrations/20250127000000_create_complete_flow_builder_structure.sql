-- =====================================================================
-- Migração: Estrutura Completa do Construtor de Fluxos (Flow Builder)
-- Data: 2025-01-27
-- Descrição: Implementa a estrutura de banco de dados fundamental para 
--           o sistema de automação de WhatsApp com fluxos
-- Arquiteto: DBA PostgreSQL Especialista
-- =====================================================================

-- =====================================================================
-- 1. TABELA FLOWS - Armazenamento dos Fluxos de Automação
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.flows (
    -- Identificação única do fluxo
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamentos organizacionais
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    chatbot_id uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
    
    -- Informações básicas do fluxo
    name text NOT NULL CHECK (length(name) >= 1 AND length(name) <= 255),
    
    -- Palavras-chave que ativam o fluxo
    trigger_keywords text[] DEFAULT '{}',
    
    -- Estrutura JSON completa do fluxo (nós, conexões, configurações)
    flow_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    
    -- Controle temporal
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints adicionais
    CONSTRAINT flows_name_not_empty CHECK (trim(name) != ''),
    CONSTRAINT flows_flow_data_not_empty CHECK (flow_data != '{}'::jsonb)
);

-- =====================================================================
-- 2. TABELA CHAT_SESSIONS - Rastreamento de Progresso nos Fluxos
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    -- Identificação única da sessão
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamentos organizacionais
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    chatbot_id uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
    
    -- Identificação do usuário
    phone_number text NOT NULL CHECK (length(phone_number) >= 8 AND length(phone_number) <= 20),
    
    -- Controle de fluxo ativo
    active_flow_id uuid REFERENCES public.flows(id) ON DELETE SET NULL,
    current_step_id text,
    
    -- Variáveis de sessão coletadas durante o fluxo
    session_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
    
    -- Status da sessão com constraint de validação
    status text NOT NULL DEFAULT 'active',
    
    -- Controle temporal
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints de validação
    CONSTRAINT chat_sessions_status_check CHECK (status IN ('active', 'completed', 'abandoned')),
    CONSTRAINT chat_sessions_phone_format CHECK (phone_number ~ '^[0-9+\-\s()]+$'),
    CONSTRAINT chat_sessions_current_step_valid CHECK (
        (active_flow_id IS NULL AND current_step_id IS NULL) OR 
        (active_flow_id IS NOT NULL)
    )
);

-- =====================================================================
-- 3. ÍNDICES OTIMIZADOS PARA PERFORMANCE
-- =====================================================================

-- Índices para tabela flows
CREATE INDEX IF NOT EXISTS idx_flows_org_id ON public.flows(org_id);
CREATE INDEX IF NOT EXISTS idx_flows_chatbot_id ON public.flows(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_flows_org_chatbot ON public.flows(org_id, chatbot_id);
CREATE INDEX IF NOT EXISTS idx_flows_trigger_keywords ON public.flows USING GIN(trigger_keywords);
CREATE INDEX IF NOT EXISTS idx_flows_flow_data ON public.flows USING GIN(flow_data);
CREATE INDEX IF NOT EXISTS idx_flows_created_at ON public.flows(created_at DESC);

-- Índices para tabela chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_id ON public.chat_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot_id ON public.chat_sessions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_phone_number ON public.chat_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active_flow_id ON public.chat_sessions(active_flow_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON public.chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_phone ON public.chat_sessions(org_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot_phone ON public.chat_sessions(chatbot_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active_sessions ON public.chat_sessions(org_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON public.chat_sessions(created_at DESC);

-- =====================================================================
-- 4. FUNÇÃO PARA ATUALIZAÇÃO AUTOMÁTICA DE UPDATED_AT
-- =====================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- =====================================================================
-- 5. TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA DE TIMESTAMPS
-- =====================================================================

-- Trigger para tabela flows
DROP TRIGGER IF EXISTS update_flows_updated_at ON public.flows;
CREATE TRIGGER update_flows_updated_at 
    BEFORE UPDATE ON public.flows 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para tabela chat_sessions
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON public.chat_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 6. ROW LEVEL SECURITY (RLS) - SEGURANÇA POR ORGANIZAÇÃO
-- =====================================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 7. POLÍTICAS RLS PARA TABELA FLOWS
-- =====================================================================

-- Política para visualizar flows da própria organização
DROP POLICY IF EXISTS "select_own_org_flows" ON public.flows;
CREATE POLICY "select_own_org_flows" ON public.flows FOR SELECT
    USING (EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.org_id = flows.org_id
    ));

-- Política para inserir flows na própria organização
DROP POLICY IF EXISTS "insert_own_org_flows" ON public.flows;
CREATE POLICY "insert_own_org_flows" ON public.flows FOR INSERT
    WITH CHECK (EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.org_id = flows.org_id
    ));

-- Política para atualizar flows da própria organização
DROP POLICY IF EXISTS "update_own_org_flows" ON public.flows;
CREATE POLICY "update_own_org_flows" ON public.flows FOR UPDATE
    USING (EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.org_id = flows.org_id
    ));

-- Política para deletar flows da própria organização
DROP POLICY IF EXISTS "delete_own_org_flows" ON public.flows;
CREATE POLICY "delete_own_org_flows" ON public.flows FOR DELETE
    USING (EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.org_id = flows.org_id
    ));

-- =====================================================================
-- 8. POLÍTICAS RLS PARA TABELA CHAT_SESSIONS
-- =====================================================================

-- Política para visualizar sessões da própria organização
DROP POLICY IF EXISTS "select_own_org_chat_sessions" ON public.chat_sessions;
CREATE POLICY "select_own_org_chat_sessions" ON public.chat_sessions FOR SELECT
    USING (EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.org_id = chat_sessions.org_id
    ));

-- Política para inserir sessões na própria organização
DROP POLICY IF EXISTS "insert_own_org_chat_sessions" ON public.chat_sessions;
CREATE POLICY "insert_own_org_chat_sessions" ON public.chat_sessions FOR INSERT
    WITH CHECK (EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.org_id = chat_sessions.org_id
    ));

-- Política para atualizar sessões da própria organização
DROP POLICY IF EXISTS "update_own_org_chat_sessions" ON public.chat_sessions;
CREATE POLICY "update_own_org_chat_sessions" ON public.chat_sessions FOR UPDATE
    USING (EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.org_id = chat_sessions.org_id
    ));

-- Política para deletar sessões da própria organização
DROP POLICY IF EXISTS "delete_own_org_chat_sessions" ON public.chat_sessions;
CREATE POLICY "delete_own_org_chat_sessions" ON public.chat_sessions FOR DELETE
    USING (EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.id = auth.uid() AND p.org_id = chat_sessions.org_id
    ));

-- =====================================================================
-- 9. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================================

-- Comentários na tabela flows
COMMENT ON TABLE public.flows IS 'Tabela para armazenar fluxos de automação do construtor de fluxos (Flow Builder)';
COMMENT ON COLUMN public.flows.id IS 'Identificador único do fluxo (UUID)';
COMMENT ON COLUMN public.flows.org_id IS 'Referência à organização proprietária do fluxo';
COMMENT ON COLUMN public.flows.chatbot_id IS 'Referência ao chatbot que utiliza este fluxo';
COMMENT ON COLUMN public.flows.name IS 'Nome descritivo do fluxo (1-255 caracteres)';
COMMENT ON COLUMN public.flows.trigger_keywords IS 'Array de palavras-chave que ativam este fluxo automaticamente';
COMMENT ON COLUMN public.flows.flow_data IS 'Estrutura JSON completa do fluxo com nós, conexões e configurações';
COMMENT ON COLUMN public.flows.created_at IS 'Timestamp de criação do fluxo';
COMMENT ON COLUMN public.flows.updated_at IS 'Timestamp da última atualização (mantido automaticamente)';

-- Comentários na tabela chat_sessions
COMMENT ON TABLE public.chat_sessions IS 'Tabela para rastrear sessões de chat e progresso dos usuários nos fluxos';
COMMENT ON COLUMN public.chat_sessions.id IS 'Identificador único da sessão de chat (UUID)';
COMMENT ON COLUMN public.chat_sessions.org_id IS 'Referência à organização proprietária da sessão';
COMMENT ON COLUMN public.chat_sessions.chatbot_id IS 'Referência ao chatbot desta sessão';
COMMENT ON COLUMN public.chat_sessions.phone_number IS 'Número de telefone do usuário (formato internacional)';
COMMENT ON COLUMN public.chat_sessions.active_flow_id IS 'Referência ao fluxo ativo para esta sessão (pode ser nulo)';
COMMENT ON COLUMN public.chat_sessions.current_step_id IS 'ID do passo atual no fluxo (pode ser nulo se não há fluxo ativo)';
COMMENT ON COLUMN public.chat_sessions.session_variables IS 'Variáveis de sessão coletadas durante a execução do fluxo (JSON)';
COMMENT ON COLUMN public.chat_sessions.status IS 'Status da sessão: active, completed, abandoned';
COMMENT ON COLUMN public.chat_sessions.created_at IS 'Timestamp de criação da sessão';
COMMENT ON COLUMN public.chat_sessions.updated_at IS 'Timestamp da última atualização (mantido automaticamente)';

-- Comentários em funções e triggers
COMMENT ON FUNCTION public.update_updated_at_column() IS 'Função para atualizar automaticamente a coluna updated_at';
COMMENT ON TRIGGER update_flows_updated_at ON public.flows IS 'Trigger para atualizar automaticamente updated_at na tabela flows';
COMMENT ON TRIGGER update_chat_sessions_updated_at ON public.chat_sessions IS 'Trigger para atualizar automaticamente updated_at na tabela chat_sessions';

-- =====================================================================
-- 10. VALIDAÇÕES E ESTATÍSTICAS FINAIS
-- =====================================================================

-- Atualizar estatísticas das tabelas para otimização do query planner
ANALYZE public.flows;
ANALYZE public.chat_sessions;

-- =====================================================================
-- MIGRAÇÃO CONCLUÍDA COM SUCESSO
-- =====================================================================
-- 
-- Esta migração implementa:
-- ✅ Tabela flows com todas as colunas especificadas
-- ✅ Tabela chat_sessions com estrutura completa para rastreamento
-- ✅ Chaves primárias e estrangeiras adequadas
-- ✅ Constraints de validação robustas
-- ✅ Índices otimizados para performance
-- ✅ Triggers automáticos para updated_at
-- ✅ Row Level Security (RLS) por organização
-- ✅ Políticas de segurança completas
-- ✅ Documentação abrangente
-- ✅ Validações de integridade de dados
-- 
-- Estrutura pronta para suportar o Construtor de Fluxos!
-- =====================================================================