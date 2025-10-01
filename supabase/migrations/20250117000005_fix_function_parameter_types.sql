-- =====================================================
-- CORREÇÃO DOS TIPOS DE PARÂMETROS DA FUNÇÃO
-- =====================================================
-- Problema: A função simple_debit_credits espera TEXT
-- mas o trigger passa UUID
-- =====================================================

-- Remover a função existente
DROP FUNCTION IF EXISTS simple_debit_credits(TEXT, INTEGER);

-- Criar nova versão da função que aceita UUID
CREATE OR REPLACE FUNCTION simple_debit_credits(
    p_org_id UUID,
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
    -- Get current balance (org_id já é UUID)
    SELECT balance INTO current_balance
    FROM credit_wallets
    WHERE org_id = p_org_id::TEXT; -- Converter UUID para TEXT para comparar com a coluna
    
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
        message_id,
        created_at,
        metadata
    ) VALUES (
        p_org_id::TEXT,
        NULL, -- agent_id não disponível no trigger
        'webhook', -- canal padrão
        0, -- input_tokens não disponível
        p_credits, -- usar credits como output_tokens
        p_credits, -- cost_credits
        NULL, -- message_id não disponível no trigger
        NOW(),
        jsonb_build_object('source', 'trigger', 'auto_debit', true)
    );
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return false
        RAISE WARNING 'Error in simple_debit_credits: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Atualizar a função do trigger para usar a nova assinatura
CREATE OR REPLACE FUNCTION messages_outbound_autodebit_ai()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se é uma mensagem outbound com billing_status 'pending'
  IF NEW.direction = 'outbound' AND NEW.billing_status = 'pending' THEN
    
    -- Chamar a função de débito (org_id já é UUID, não precisa converter)
    PERFORM simple_debit_credits(NEW.org_id, NEW.tokens_used);
    
    -- Atualizar o billing_status para 'debited'
    NEW.billing_status = 'debited';
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION simple_debit_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION simple_debit_credits(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION simple_debit_credits(UUID, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION messages_outbound_autodebit_ai() TO authenticated;
GRANT EXECUTE ON FUNCTION messages_outbound_autodebit_ai() TO anon;
GRANT EXECUTE ON FUNCTION messages_outbound_autodebit_ai() TO service_role;

-- Log da migração
DO $$
BEGIN
  RAISE NOTICE 'Função simple_debit_credits corrigida para aceitar UUID como parâmetro';
END $$;