-- Função para sincronizar saldos entre credit_wallets e organization_credits
-- Esta função copia os saldos da tabela credit_wallets para organization_credits

CREATE OR REPLACE FUNCTION sync_wallet_tables()
RETURNS JSON AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_created_count INTEGER := 0;
  v_updated_count INTEGER := 0;
BEGIN
  -- Inserir organizações que existem em credit_wallets mas não em organization_credits
  INSERT INTO organization_credits (org_id, balance, created_at, updated_at)
  SELECT 
    cw.org_id, 
    cw.balance, 
    cw.created_at, 
    cw.updated_at
  FROM credit_wallets cw
  WHERE cw.org_id NOT IN (SELECT org_id FROM organization_credits)
  ON CONFLICT (org_id) DO NOTHING;
  
  GET DIAGNOSTICS v_created_count = ROW_COUNT;
  
  -- Atualizar saldos existentes em organization_credits com base em credit_wallets
  UPDATE organization_credits oc
  SET 
    balance = cw.balance,
    updated_at = NOW()
  FROM credit_wallets cw
  WHERE oc.org_id = cw.org_id
  AND oc.balance != cw.balance;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Inserir organizações que existem em organization_credits mas não em credit_wallets
  INSERT INTO credit_wallets (org_id, balance, currency, created_at, updated_at)
  SELECT 
    oc.org_id, 
    oc.balance, 
    'BRL' as currency,
    oc.created_at, 
    oc.updated_at
  FROM organization_credits oc
  WHERE oc.org_id NOT IN (SELECT org_id FROM credit_wallets)
  ON CONFLICT (org_id) DO NOTHING;
  
  v_synced_count := v_created_count + v_updated_count;
  
  RETURN json_build_object(
    'success', true,
    'synced_records', v_synced_count,
    'created_in_org_credits', v_created_count,
    'updated_in_org_credits', v_updated_count,
    'message', 'Tabelas sincronizadas com sucesso'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Erro na sincronização: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Executar a sincronização
SELECT sync_wallet_tables();

-- Verificar os resultados
SELECT 
  'credit_wallets' as tabela,
  COUNT(*) as total_registros,
  SUM(balance) as total_saldo
FROM credit_wallets
UNION ALL
SELECT 
  'organization_credits' as tabela,
  COUNT(*) as total_registros,
  SUM(balance) as total_saldo
FROM organization_credits;

-- Verificar se há discrepâncias
SELECT 
  cw.org_id,
  cw.balance as wallet_balance,
  oc.balance as org_credits_balance,
  (cw.balance - oc.balance) as diferenca
FROM credit_wallets cw
FULL OUTER JOIN organization_credits oc ON cw.org_id = oc.org_id
WHERE cw.balance != oc.balance OR cw.org_id IS NULL OR oc.org_id IS NULL;