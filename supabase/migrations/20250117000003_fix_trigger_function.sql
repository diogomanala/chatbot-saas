-- =====================================================
-- CORREÇÃO DO TRIGGER messages_outbound_autodebit_ai
-- =====================================================
-- Problema: O trigger chama simple_debit_credits(org_id, credits) 
-- mas a função atual requer 8 parâmetros
-- =====================================================

-- 1. Criar versão simplificada da função simple_debit_credits para o trigger
CREATE OR REPLACE FUNCTION simple_debit_credits(
    p_org_id TEXT,
    p_credits INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance NUMERIC;
    new_balance NUMERIC;
BEGIN
    -- Get current balance (cast org_id to match column type if needed)
    SELECT balance INTO current_balance
    FROM credit_wallets
    WHERE org_id = p_org_id::TEXT;
    
    -- Check if wallet exists
    IF current_balance IS NULL THEN
        -- Create wallet if it doesn't exist
        INSERT INTO credit_wallets (org_id, balance, created_at, updated_at)
        VALUES (p_org_id::TEXT, 0, NOW(), NOW())
        ON CONFLICT (org_id) DO NOTHING;
        current_balance := 0;
    END IF;
    
    -- Check sufficient balance (allow negative for now)
    new_balance := current_balance - p_credits;
    
    -- Update wallet balance
    UPDATE credit_wallets 
    SET balance = new_balance, updated_at = NOW()
    WHERE org_id = p_org_id::TEXT;
    
    -- Insert usage event
    INSERT INTO usage_events (
        org_id, 
        agent_id, 
        channel, 
        input_tokens, 
        output_tokens, 
        cost_credits,
        created_at
    ) VALUES (
        p_org_id::TEXT,
        'system',
        'webhook',
        0,
        p_credits,
        p_credits,
        NOW()
    );
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in simple_debit_credits: %', SQLERRM;
        RETURN FALSE;
END $$;

-- 2. Corrigir a função do trigger messages_outbound_autodebit_ai
CREATE OR REPLACE FUNCTION messages_outbound_autodebit_ai()
RETURNS trigger AS $$
DECLARE
  v_used int;
  v_current_tokens int;
BEGIN
  IF NEW.direction = 'outbound'
     AND COALESCE(NEW.billing_status,'pending') IN ('pending','skipped','charged') THEN

    -- Verificar se já tem tokens_used válidos
    SELECT tokens_used INTO v_current_tokens 
    FROM messages 
    WHERE id = NEW.id;
    
    -- Se já tem tokens válidos (>0), usa eles. Senão, calcula.
    IF v_current_tokens IS NOT NULL AND v_current_tokens > 0 THEN
      v_used := v_current_tokens;
    ELSE
      v_used := GREATEST(COALESCE(NEW.tokens_used,0), COALESCE(NEW.tokens_estimated,0), 50);
    END IF;

    -- Debitar créditos usando a função corrigida
    -- Garantir que org_id seja tratado como TEXT
    PERFORM simple_debit_credits(NEW.org_id::TEXT, v_used);

    -- Finalizar mensagem
    UPDATE messages
       SET tokens_used    = v_used,
           billing_status = 'debited',
           billed_at      = now()
     WHERE id = NEW.id;
     
  END IF;
  RETURN NULL; -- AFTER trigger ignora retorno
END;
$$ LANGUAGE plpgsql;

-- 3. Recriar o trigger
DROP TRIGGER IF EXISTS messages_outbound_autodebit_ai ON messages;
CREATE TRIGGER messages_outbound_autodebit_ai
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION messages_outbound_autodebit_ai();

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION simple_debit_credits(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION simple_debit_credits(TEXT, INTEGER) TO authenticated;