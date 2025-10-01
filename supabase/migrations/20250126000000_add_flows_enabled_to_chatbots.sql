-- Migração para adicionar feature flag flows_enabled à tabela chatbots
-- Data: 2025-01-26
-- Descrição: Adiciona coluna booleana para controlar se o chatbot deve usar o motor de fluxos

-- Adicionar coluna flows_enabled à tabela chatbots
ALTER TABLE public.chatbots ADD COLUMN IF NOT EXISTS flows_enabled boolean NOT NULL DEFAULT false;

-- Criar índice para otimizar consultas por flows_enabled
CREATE INDEX IF NOT EXISTS idx_chatbots_flows_enabled ON public.chatbots(flows_enabled);

-- Comentário para documentação
COMMENT ON COLUMN public.chatbots.flows_enabled IS 'Feature flag que controla se o chatbot deve usar o motor de fluxos (true) ou a IA geral (false)';