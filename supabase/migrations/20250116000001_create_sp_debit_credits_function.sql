-- Create stored procedure to debit credits from organization wallet
CREATE OR REPLACE FUNCTION sp_debit_credits(
    p_org_id TEXT,
    p_units NUMERIC,
    p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance NUMERIC;
    wallet_id UUID;
BEGIN
    -- Get current wallet balance and ID
    SELECT id, balance INTO wallet_id, current_balance
    FROM credit_wallets
    WHERE org_id = p_org_id;
    
    -- Check if wallet exists
    IF wallet_id IS NULL THEN
        RAISE EXCEPTION 'Credit wallet not found for organization: %', p_org_id;
    END IF;
    
    -- Check if sufficient balance
    IF current_balance < p_units THEN
        RETURN FALSE;
    END IF;
    
    -- Debit credits from wallet
    UPDATE credit_wallets
    SET balance = balance - p_units,
        updated_at = NOW()
    WHERE org_id = p_org_id;

    -- Skip usage ledger entry for now (table may not exist)
    -- INSERT INTO usage_ledger (org_id, utype, units, note)
    -- VALUES (p_org_id, 'ai', p_units, COALESCE(p_note, 'Credit debit via sp_debit_credits'));
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return false
        RAISE LOG 'Error in sp_debit_credits for org %: %', p_org_id, SQLERRM;
        RETURN FALSE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sp_debit_credits(TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_debit_credits(TEXT, NUMERIC, TEXT) TO service_role;