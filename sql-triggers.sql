-- SQL Triggers para débito automático de mensagens
-- Cole tudo abaixo no mesmo banco que a UI usa.

-- (Opcional) id default 
ALTER TABLE messages 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- INBOUND nunca cobra (normaliza logo na inserção)
CREATE OR REPLACE FUNCTION messages_inbound_normalize_bi()
RETURNS trigger AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    NEW.billing_status := 'no_charge';
    NEW.tokens_used    := COALESCE(NEW.tokens_used, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_inbound_normalize_bi ON messages;
CREATE TRIGGER messages_inbound_normalize_bi
BEFORE INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION messages_inbound_normalize_bi();


-- OUTBOUND: qualquer insert 'pending/skipped/charged' vira DEBITADO no ato
-- usa sua função real de débito: simple_debit_credits(org_id, credits)
CREATE OR REPLACE FUNCTION messages_outbound_autodebit_ai()
RETURNS trigger AS $$
DECLARE
  v_used int;
BEGIN
  IF NEW.direction = 'outbound'
     AND COALESCE(NEW.billing_status,'pending') IN ('pending','skipped','charged') THEN

    v_used := GREATEST(COALESCE(NEW.tokens_used,0), COALESCE(NEW.tokens_estimated,0), 50);

    -- debita créditos
    PERFORM simple_debit_credits(NEW.org_id, v_used);

    -- finaliza mensagem
    UPDATE messages
       SET tokens_used    = v_used,
           billing_status = 'debited',
           billed_at      = now()
     WHERE id = NEW.id;
  END IF;
  RETURN NULL; -- AFTER trigger ignora retorno
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_outbound_autodebit_ai ON messages;
CREATE TRIGGER messages_outbound_autodebit_ai
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION messages_outbound_autodebit_ai();


-- Impede "voltar para pending" com tokens>0
CREATE OR REPLACE FUNCTION messages_prevent_pending_bu()
RETURNS trigger AS $$
BEGIN
  IF NEW.direction='outbound'
     AND COALESCE(NEW.tokens_used,0) > 0
     AND NEW.billing_status='pending' THEN
    RAISE EXCEPTION 'Mensagem % não pode voltar para pending com tokens_used > 0', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_prevent_pending_bu ON messages;
CREATE TRIGGER messages_prevent_pending_bu
BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION messages_prevent_pending_bu();


-- =====================================================
-- SISTEMA DE COBRANÇA SIMPLIFICADO V2
-- =====================================================
-- Toda mensagem outbound = 1 crédito
-- Status: apenas 'debited', 'errored' ou 'no_charge'
-- Tokens: sempre 1 para outbound, 0 para inbound
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