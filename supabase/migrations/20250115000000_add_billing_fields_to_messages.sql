-- Adicionar campos de cobrança à tabela messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS cost_credits decimal(10,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS charged_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS billing_status text DEFAULT 'pending' CHECK (billing_status IN ('pending', 'charged', 'failed', 'skipped'));

-- Criar índice para otimizar consultas de cobrança
CREATE INDEX IF NOT EXISTS idx_messages_billing_status ON public.messages(billing_status);
CREATE INDEX IF NOT EXISTS idx_messages_charged_at ON public.messages(charged_at);
CREATE INDEX IF NOT EXISTS idx_messages_org_billing ON public.messages(org_id, billing_status, created_at);

-- Comentários para documentar os novos campos
COMMENT ON COLUMN public.messages.cost_credits IS 'Custo em créditos para processar esta mensagem';
COMMENT ON COLUMN public.messages.charged_at IS 'Timestamp quando a cobrança foi processada';
COMMENT ON COLUMN public.messages.billing_status IS 'Status da cobrança: pending (aguardando), charged (cobrado), failed (falhou), skipped (pulado)';

-- Atualizar mensagens existentes para ter status 'skipped' (não cobrar retroativamente)
UPDATE public.messages 
SET billing_status = 'skipped', charged_at = now()
WHERE billing_status = 'pending' AND created_at < now() - interval '1 hour';