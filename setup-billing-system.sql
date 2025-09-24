-- =====================================================
-- SCRIPT COMPLETO PARA SISTEMA DE COBRANÇA
-- Copie e cole este script no SQL Editor do Supabase
-- =====================================================

-- 1. Criar tabela para controle de créditos das organizações
CREATE TABLE IF NOT EXISTS organization_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT UNIQUE NOT NULL,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela para histórico de cobrança de mensagens
CREATE TABLE IF NOT EXISTS message_billing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  org_id TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  credits_charged DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  charged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (org_id) REFERENCES organization_credits(org_id)
);

-- 3. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_message_billing_org_id ON message_billing(org_id);
CREATE INDEX IF NOT EXISTS idx_message_billing_message_id ON message_billing(message_id);
CREATE INDEX IF NOT EXISTS idx_message_billing_charged_at ON message_billing(charged_at);
CREATE INDEX IF NOT EXISTS idx_organization_credits_org_id ON organization_credits(org_id);

-- 4. Criar função para calcular tokens baseado no conteúdo
CREATE OR REPLACE FUNCTION calculate_tokens(content TEXT)
RETURNS INTEGER AS $$
BEGIN
  -- Estimativa simples: ~4 caracteres por token
  RETURN GREATEST(1, LENGTH(content) / 4);
END;
$$ LANGUAGE plpgsql;

-- 5. Criar função para processar cobrança de mensagem
CREATE OR REPLACE FUNCTION process_message_billing(
  p_message_id UUID,
  p_org_id TEXT,
  p_content TEXT
)
RETURNS JSON AS $$
DECLARE
  v_tokens INTEGER;
  v_credits_per_token DECIMAL(10,4) := 0.001; -- R$ 0,001 por token
  v_credits_charged DECIMAL(10,2);
  v_current_balance DECIMAL(10,2);
  v_new_balance DECIMAL(10,2);
  v_billing_id UUID;
BEGIN
  -- Verificar se já foi cobrado
  IF EXISTS (SELECT 1 FROM message_billing WHERE message_id = p_message_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Message already billed',
      'message_id', p_message_id
    );
  END IF;
  
  -- Calcular tokens
  v_tokens := calculate_tokens(p_content);
  v_credits_charged := v_tokens * v_credits_per_token;
  
  -- Obter saldo atual
  SELECT balance INTO v_current_balance 
  FROM organization_credits 
  WHERE org_id = p_org_id;
  
  -- Se organização não existe, criar com saldo inicial
  IF v_current_balance IS NULL THEN
    INSERT INTO organization_credits (org_id, balance)
    VALUES (p_org_id, 1000.00)
    RETURNING balance INTO v_current_balance;
  END IF;
  
  -- Verificar se tem saldo suficiente
  IF v_current_balance < v_credits_charged THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'current_balance', v_current_balance,
      'required', v_credits_charged
    );
  END IF;
  
  -- Debitar créditos
  v_new_balance := v_current_balance - v_credits_charged;
  
  UPDATE organization_credits 
  SET balance = v_new_balance, updated_at = NOW()
  WHERE org_id = p_org_id;
  
  -- Registrar cobrança
  INSERT INTO message_billing (message_id, org_id, tokens_used, credits_charged)
  VALUES (p_message_id, p_org_id, v_tokens, v_credits_charged)
  RETURNING id INTO v_billing_id;
  
  RETURN json_build_object(
    'success', true,
    'billing_id', v_billing_id,
    'tokens_used', v_tokens,
    'credits_charged', v_credits_charged,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql;

-- 6. Criar função para obter estatísticas de cobrança
CREATE OR REPLACE FUNCTION get_billing_stats(p_org_id TEXT)
RETURNS JSON AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_total_charged DECIMAL(10,2);
  v_total_messages INTEGER;
  v_total_tokens INTEGER;
BEGIN
  -- Obter saldo atual
  SELECT balance INTO v_current_balance
  FROM organization_credits
  WHERE org_id = p_org_id;
  
  -- Obter estatísticas de cobrança
  SELECT 
    COALESCE(SUM(credits_charged), 0),
    COUNT(*),
    COALESCE(SUM(tokens_used), 0)
  INTO v_total_charged, v_total_messages, v_total_tokens
  FROM message_billing
  WHERE org_id = p_org_id;
  
  RETURN json_build_object(
    'org_id', p_org_id,
    'current_balance', COALESCE(v_current_balance, 0),
    'total_charged', v_total_charged,
    'total_messages', v_total_messages,
    'total_tokens', v_total_tokens,
    'average_tokens_per_message', 
      CASE WHEN v_total_messages > 0 THEN v_total_tokens::DECIMAL / v_total_messages ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql;

-- 7. Criar função para adicionar créditos
CREATE OR REPLACE FUNCTION add_credits(
  p_org_id TEXT,
  p_amount DECIMAL(10,2)
)
RETURNS JSON AS $$
DECLARE
  v_new_balance DECIMAL(10,2);
BEGIN
  -- Inserir ou atualizar saldo
  INSERT INTO organization_credits (org_id, balance)
  VALUES (p_org_id, p_amount)
  ON CONFLICT (org_id) 
  DO UPDATE SET 
    balance = organization_credits.balance + p_amount,
    updated_at = NOW()
  RETURNING balance INTO v_new_balance;
  
  RETURN json_build_object(
    'success', true,
    'org_id', p_org_id,
    'credits_added', p_amount,
    'new_balance', v_new_balance
  );
END;
$$ LANGUAGE plpgsql;

-- 8. Inserir saldos iniciais para organizações existentes
INSERT INTO organization_credits (org_id, balance)
SELECT DISTINCT org_id, 1000.00
FROM messages 
WHERE org_id IS NOT NULL
ON CONFLICT (org_id) DO NOTHING;

-- 9. Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organization_credits_updated_at
  BEFORE UPDATE ON organization_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Habilitar RLS (Row Level Security) se necessário
ALTER TABLE organization_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_billing ENABLE ROW LEVEL SECURITY;

-- 11. Criar políticas básicas de segurança (ajuste conforme necessário)
CREATE POLICY "Users can view their own organization credits" ON organization_credits
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own billing history" ON message_billing
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- COMANDOS DE TESTE (opcional - execute após o setup)
-- =====================================================

-- Testar função de cobrança
-- SELECT process_message_billing(
--   gen_random_uuid(),
--   'test-org-123',
--   'Esta é uma mensagem de teste para calcular tokens e cobrar créditos.'
-- );

-- Verificar estatísticas
-- SELECT get_billing_stats('test-org-123');

-- Adicionar créditos
-- SELECT add_credits('test-org-123', 500.00);

-- Verificar tabelas criadas
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('organization_credits', 'message_billing');

-- =====================================================
-- SETUP COMPLETO!
-- Agora você pode integrar as funções no seu código Node.js
-- =====================================================