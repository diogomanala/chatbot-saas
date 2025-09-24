-- Função RPC simplificada para débito de créditos
-- Sistema simplificado: sempre debita 1 crédito por mensagem respondida

CREATE OR REPLACE FUNCTION debit_credits_simple(
  p_org_id UUID,
  p_credits INTEGER DEFAULT 1,
  p_message_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_result JSON;
BEGIN
  -- Verificar saldo atual
  SELECT balance 
  INTO v_current_balance
  FROM credit_wallets 
  WHERE org_id = p_org_id;
  
  -- Se organização não encontrada
  IF v_current_balance IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Organization not found',
      'org_id', p_org_id
    );
  END IF;
  
  -- Verificar se tem saldo suficiente
  IF v_current_balance < p_credits THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'current_balance', v_current_balance,
      'required_credits', p_credits,
      'org_id', p_org_id
    );
  END IF;
  
  -- Calcular novo saldo
  v_new_balance := v_current_balance - p_credits;
  
  -- Debitar créditos
  UPDATE credit_wallets 
  SET 
    balance = v_new_balance,
    updated_at = NOW()
  WHERE org_id = p_org_id;
  
  -- Registrar transação na tabela de transações (se existir)
  BEGIN
    INSERT INTO credit_transactions (
      org_id,
      transaction_type,
      amount,
      balance_before,
      balance_after,
      description,
      metadata,
      created_at
    ) VALUES (
      p_org_id,
      'debit',
      p_credits,
      v_current_balance,
      v_new_balance,
      'Message response billing - simplified system',
      json_build_object(
        'system', 'simplified_v2',
        'message_id', p_message_id,
        'credits_debited', p_credits,
        'processed_at', NOW()
      ),
      NOW()
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Se tabela de transações não existir, continuar sem erro
      NULL;
  END;
  
  -- Retornar resultado
  v_result := json_build_object(
    'success', true,
    'org_id', p_org_id,
    'credits_debited', p_credits,
    'balance_before', v_current_balance,
    'balance_after', v_new_balance,
    'message_id', p_message_id,
    'processed_at', NOW()
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'org_id', p_org_id,
      'credits', p_credits
    );
END;
$$;

-- Comentário da função
COMMENT ON FUNCTION debit_credits_simple(UUID, INTEGER, UUID) IS 
'Sistema simplificado de débito de créditos - sempre debita 1 crédito por mensagem respondida';