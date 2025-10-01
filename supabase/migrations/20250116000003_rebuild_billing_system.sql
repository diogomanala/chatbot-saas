-- Rebuild billing system - Remove all RLS and complex functions
-- Drop existing problematic policies and functions

-- Drop ALL existing policies that might depend on org_id column
DROP POLICY IF EXISTS "Service role can insert usage events" ON usage_events;
DROP POLICY IF EXISTS "Users can view their organization's usage events" ON usage_events;
DROP POLICY IF EXISTS "Service role can insert credit wallets" ON credit_wallets;
DROP POLICY IF EXISTS "Users can view their organization's credit wallet" ON credit_wallets;
DROP POLICY IF EXISTS "Super admins can view all topup events" ON topup_events;
DROP POLICY IF EXISTS "Users can insert own org usage" ON usage_ledger;
DROP POLICY IF EXISTS "Users can view own org usage" ON usage_ledger;
DROP POLICY IF EXISTS "Super admins can view all usage" ON usage_ledger;
DROP POLICY IF EXISTS "Service role can manage all usage" ON usage_ledger;

-- Drop existing functions
DROP FUNCTION IF EXISTS sp_debit_credits(TEXT, NUMERIC, TEXT);

-- Disable RLS on all billing tables
ALTER TABLE credit_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE topup_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE usage_ledger DISABLE ROW LEVEL SECURITY;

-- Drop foreign key constraints that prevent type changes
ALTER TABLE usage_ledger DROP CONSTRAINT IF EXISTS usage_ledger_org_id_fkey;
ALTER TABLE usage_events DROP CONSTRAINT IF EXISTS usage_events_org_id_fkey;
ALTER TABLE credit_wallets DROP CONSTRAINT IF EXISTS credit_wallets_org_id_fkey;
ALTER TABLE topup_events DROP CONSTRAINT IF EXISTS topup_events_org_id_fkey;

-- Simplify table structures - ensure all ID fields are text for consistency
ALTER TABLE credit_wallets ALTER COLUMN org_id TYPE text;
ALTER TABLE usage_events ALTER COLUMN org_id TYPE text;
ALTER TABLE usage_events ALTER COLUMN agent_id TYPE text;
ALTER TABLE usage_events ALTER COLUMN message_id TYPE text;
ALTER TABLE topup_events ALTER COLUMN org_id TYPE text;
ALTER TABLE topup_events ALTER COLUMN performed_by_user_id TYPE text;
ALTER TABLE usage_ledger ALTER COLUMN org_id TYPE text;

-- Grant full access to service role and authenticated users
GRANT ALL ON credit_wallets TO service_role;
GRANT ALL ON usage_events TO service_role;
GRANT ALL ON topup_events TO service_role;
GRANT ALL ON usage_ledger TO service_role;

GRANT SELECT, INSERT, UPDATE ON credit_wallets TO authenticated;
GRANT SELECT, INSERT ON usage_events TO authenticated;
GRANT SELECT ON topup_events TO authenticated;
GRANT SELECT ON usage_ledger TO authenticated;

-- Create simple indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_wallets_org_id ON credit_wallets(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_org_id ON usage_events(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_message_id ON usage_events(message_id);
CREATE INDEX IF NOT EXISTS idx_topup_events_org_id ON topup_events(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_org_id ON usage_ledger(org_id);

-- Create simple debit function without complex type conversions
CREATE OR REPLACE FUNCTION simple_debit_credits(
    p_org_id text,
    p_agent_id text,
    p_input_tokens integer,
    p_output_tokens integer,
    p_cost_credits numeric,
    p_channel text,
    p_message_id text DEFAULT NULL,
    p_meta jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance numeric;
    new_balance numeric;
    usage_event_id uuid;
BEGIN
    -- Get current balance
    SELECT balance INTO current_balance
    FROM credit_wallets
    WHERE org_id = p_org_id;
    
    -- Check if wallet exists
    IF current_balance IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Credit wallet not found'
        );
    END IF;
    
    -- Check sufficient balance
    IF current_balance < p_cost_credits THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Insufficient credits'
        );
    END IF;
    
    -- Check for duplicate message_id (idempotency)
    IF p_message_id IS NOT NULL THEN
        SELECT id INTO usage_event_id
        FROM usage_events
        WHERE message_id = p_message_id;
        
        IF usage_event_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Credits already debited',
                'usage_event_id', usage_event_id
            );
        END IF;
    END IF;
    
    -- Calculate new balance
    new_balance := current_balance - p_cost_credits;
    
    -- Update wallet balance
    UPDATE credit_wallets
    SET balance = new_balance,
        updated_at = NOW()
    WHERE org_id = p_org_id;
    
    -- Create usage event
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
    ) RETURNING id INTO usage_event_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Credits debited successfully',
        'usage_event_id', usage_event_id,
        'new_balance', new_balance
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Error: ' || SQLERRM
        );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION simple_debit_credits(text, text, integer, integer, numeric, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION simple_debit_credits(text, text, integer, integer, numeric, text, text, jsonb) TO authenticated;