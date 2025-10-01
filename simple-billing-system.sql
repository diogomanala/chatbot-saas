-- =====================================================
-- SISTEMA DE COBRANÇA SIMPLIFICADO V2
-- =====================================================
-- Toda mensagem outbound = 1 crédito
-- Status: apenas 'debited' ou 'errored'
-- Tokens: sempre 1
-- =====================================================

-- 1. REMOVER TRIGGERS E CONSTRAINTS ANTIGOS
DROP TRIGGER IF EXISTS trigger_auto_debit_outbound ON messages;
DROP TRIGGER IF EXISTS trigger_set_billing_status ON messages;
DROP FUNCTION IF EXISTS auto_debit_outbound_message();
DROP FUNCTION IF EXISTS set_billing_status_on_insert();

-- Remover constraints antigas
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_billing_status_allowed_ck;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_tokens_positive_on_debited_ck;

-- 2. NOVA CONSTRAINT SIMPLIFICADA
ALTER TABLE messages ADD CONSTRAINT messages_billing_status_simple_ck 
CHECK (billing_status IN ('debited', 'errored', 'no_charge'));

-- 3. FUNÇÃO PARA DÉBITO SIMPLES
CREATE OR REPLACE FUNCTION debit_credits_simple(
  p_org_id TEXT,
  p_credits INTEGER,
  p_message_id TEXT
) RETURNS VOID AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Verificar saldo atual
  SELECT balance INTO current_balance 
  FROM credit_wallets 
  WHERE org_id = p_org_id;
  
  -- Se não tem saldo suficiente, erro
  IF current_balance < p_credits THEN
    RAISE EXCEPTION 'Saldo insuficiente: % créditos disponíveis, % necessários', current_balance, p_credits;
  END IF;
  
  -- Debitar do saldo
  UPDATE credit_wallets 
  SET balance = balance - p_credits,
      updated_at = NOW()
  WHERE org_id = p_org_id;
  
  -- Registrar na wallet
  INSERT INTO wallet_transactions (
    org_id,
    type,
    amount,
    description,
    reference_id,
    created_at
  ) VALUES (
    p_org_id,
    'debit',
    p_credits,
    'Cobrança automática - mensagem outbound',
    p_message_id,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- 4. TRIGGER PARA INBOUND (sem cobrança)
CREATE OR REPLACE FUNCTION set_inbound_no_charge()
RETURNS TRIGGER AS $$
BEGIN
  -- Mensagens inbound sempre sem cobrança
  IF NEW.direction = 'inbound' THEN
    NEW.billing_status := 'no_charge';
    NEW.tokens_used := 0;
    NEW.cost_credits := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_inbound_no_charge
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_inbound_no_charge();

-- 5. LIMPEZA DE DADOS EXISTENTES
-- Atualizar mensagens inbound
UPDATE messages 
SET billing_status = 'no_charge',
    tokens_used = 0,
    cost_credits = 0
WHERE direction = 'inbound';

-- Atualizar mensagens outbound para o novo sistema
UPDATE messages 
SET billing_status = 'debited',
    tokens_used = 1,
    cost_credits = 1,
    charged_at = COALESCE(charged_at, created_at)
WHERE direction = 'outbound' 
  AND billing_status IN ('pending', 'charged', 'skipped', 'failed');

-- 6. VERIFICAÇÃO FINAL
SELECT 
  billing_status,
  direction,
  COUNT(*) as total,
  AVG(tokens_used) as avg_tokens,
  AVG(cost_credits) as avg_credits
FROM messages 
GROUP BY billing_status, direction 
ORDER BY billing_status, direction;