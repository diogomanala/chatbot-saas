-- Fix duplicate simple_debit_credits functions
-- Remove all versions and recreate with single signature

BEGIN;

-- Drop all versions of simple_debit_credits function
DROP FUNCTION IF EXISTS simple_debit_credits(TEXT, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS simple_debit_credits(TEXT, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.simple_debit_credits(TEXT, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.simple_debit_credits(TEXT, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT, TEXT);

-- Create single version with JSONB meta parameter
CREATE OR REPLACE FUNCTION simple_debit_credits(
    p_org_id TEXT,
    p_agent_id TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_cost_credits NUMERIC,
    p_channel TEXT,
    p_message_id TEXT,
    p_meta JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    v_wallet_balance NUMERIC;
    v_wallet_exists BOOLEAN;
BEGIN
    -- Check if wallet exists and get balance
    SELECT balance INTO v_wallet_balance
    FROM credit_wallets
    WHERE org_id = p_org_id;
    
    v_wallet_exists := FOUND;
    
    -- Create wallet if it doesn't exist
    IF NOT v_wallet_exists THEN
        INSERT INTO credit_wallets (org_id, balance, currency)
        VALUES (p_org_id, 0, 'BRL')
        ON CONFLICT (org_id) DO NOTHING;
        v_wallet_balance := 0;
    END IF;
    
    -- Check if there are sufficient credits
    IF v_wallet_balance < p_cost_credits THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'insufficient_credits',
            'balance', v_wallet_balance,
            'required', p_cost_credits
        );
    END IF;
    
    -- Debit credits from wallet
    UPDATE credit_wallets
    SET balance = balance - p_cost_credits,
        updated_at = NOW()
    WHERE org_id = p_org_id;
    
    -- Record usage event
    INSERT INTO usage_events (
        org_id,
        agent_id,
        channel,
        input_tokens,
        output_tokens,
        cost_credits,
        message_id,
        meta
    ) VALUES (
        p_org_id,
        p_agent_id,
        p_channel,
        p_input_tokens,
        p_output_tokens,
        p_cost_credits,
        p_message_id,
        p_meta
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'balance', v_wallet_balance - p_cost_credits,
        'debited', p_cost_credits
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION simple_debit_credits(TEXT, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION simple_debit_credits(TEXT, TEXT, INTEGER, INTEGER, NUMERIC, TEXT, TEXT, JSONB) TO authenticated;

COMMIT;