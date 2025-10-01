-- Migração para implementar a estrutura do Construtor de Fluxos (Flow Builder)
-- Data: 2025-01-25
-- Descrição: Cria a tabela flows e chat_sessions para suportar automação de WhatsApp

-- 1. Criar a tabela flows
CREATE TABLE IF NOT EXISTS public.flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  chatbot_id uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_keywords text[] DEFAULT '{}',
  flow_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Adicionar colunas necessárias à tabela chat_sessions existente
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS sender_phone text;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS active_flow_id uuid REFERENCES public.flows(id) ON DELETE SET NULL;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS current_step_id text;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS session_variables jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Adicionar constraint de status se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'chat_sessions_status_check'
    ) THEN
        ALTER TABLE public.chat_sessions ADD CONSTRAINT chat_sessions_status_check 
        CHECK (status IN ('active', 'completed', 'abandoned'));
    END IF;
END $$;

-- 3. Criar índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_flows_org_id ON public.flows(org_id);
CREATE INDEX IF NOT EXISTS idx_flows_chatbot_id ON public.flows(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_flows_trigger_keywords ON public.flows USING GIN(trigger_keywords);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_id ON public.chat_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot_id ON public.chat_sessions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_sender_phone ON public.chat_sessions(sender_phone);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_active_flow_id ON public.chat_sessions(active_flow_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON public.chat_sessions(status);

-- 4. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Criar triggers para atualizar updated_at
CREATE TRIGGER update_flows_updated_at 
    BEFORE UPDATE ON public.flows 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON public.chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Habilitar RLS (Row Level Security)
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- 7. Criar políticas RLS para flows
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

-- 8. Criar políticas RLS para chat_sessions
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

-- 9. Comentários nas tabelas para documentação
COMMENT ON TABLE public.flows IS 'Tabela para armazenar fluxos de automação do construtor de fluxos';
COMMENT ON COLUMN public.flows.flow_data IS 'Estrutura JSON do fluxo com nós, conexões e configurações';
COMMENT ON COLUMN public.flows.trigger_keywords IS 'Array de palavras-chave que ativam este fluxo';

COMMENT ON TABLE public.chat_sessions IS 'Tabela para rastrear sessões de chat e progresso nos fluxos';
COMMENT ON COLUMN public.chat_sessions.session_variables IS 'Variáveis de sessão coletadas durante o fluxo';
COMMENT ON COLUMN public.chat_sessions.current_step_id IS 'ID do passo atual no fluxo';
COMMENT ON COLUMN public.chat_sessions.active_flow_id IS 'Referência ao fluxo ativo para esta sessão';