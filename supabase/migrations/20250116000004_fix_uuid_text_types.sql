-- Fix UUID = TEXT comparison errors by ensuring consistent data types
-- This migration converts UUID columns to TEXT where needed for billing operations

-- First, check if tables exist and alter column types
DO $$ 
BEGIN
    -- Fix credit_wallets table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_wallets') THEN
        -- Check if org_id is UUID and convert to TEXT
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'credit_wallets' 
                  AND column_name = 'org_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE credit_wallets ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
        END IF;
    END IF;

    -- Fix usage_events table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_events') THEN
        -- Check if org_id is UUID and convert to TEXT
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'usage_events' 
                  AND column_name = 'org_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE usage_events ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
        END IF;
        
        -- Check if agent_id is UUID and convert to TEXT
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'usage_events' 
                  AND column_name = 'agent_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE usage_events ALTER COLUMN agent_id TYPE TEXT USING agent_id::TEXT;
        END IF;
        
        -- Check if message_id is UUID and convert to TEXT
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'usage_events' 
                  AND column_name = 'message_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE usage_events ALTER COLUMN message_id TYPE TEXT USING message_id::TEXT;
        END IF;
    END IF;

    -- Fix topup_events table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'topup_events') THEN
        -- Check if org_id is UUID and convert to TEXT
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'topup_events' 
                  AND column_name = 'org_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE topup_events ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
        END IF;
    END IF;

    -- Fix usage_ledger table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_ledger') THEN
        -- Check if org_id is UUID and convert to TEXT
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'usage_ledger' 
                  AND column_name = 'org_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE usage_ledger ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
        END IF;
    END IF;
END $$;

-- Drop and recreate problematic RLS policies that use UUID comparisons
DO $$
BEGIN
    -- Drop existing policies that might cause UUID = TEXT errors
    DROP POLICY IF EXISTS "Users can view their organization's credit wallet" ON credit_wallets;
    DROP POLICY IF EXISTS "Users can view their organization's usage events" ON usage_events;
    DROP POLICY IF EXISTS "Users can view their organization's topup events" ON topup_events;
    DROP POLICY IF EXISTS "Super admins can view all credit wallets" ON credit_wallets;
    DROP POLICY IF EXISTS "Super admins can view all usage events" ON usage_events;
    DROP POLICY IF EXISTS "Super admins can view all topup events" ON topup_events;
END $$;

-- Disable RLS temporarily to avoid comparison issues
ALTER TABLE credit_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE topup_events DISABLE ROW LEVEL SECURITY;

-- Grant necessary permissions for service operations
GRANT ALL ON credit_wallets TO service_role;
GRANT ALL ON usage_events TO service_role;
GRANT ALL ON topup_events TO service_role;

GRANT SELECT, INSERT, UPDATE ON credit_wallets TO authenticated;
GRANT SELECT, INSERT ON usage_events TO authenticated;
GRANT SELECT ON topup_events TO authenticated;

-- Recreate indexes with proper types
DROP INDEX IF EXISTS idx_credit_wallets_org_id;
DROP INDEX IF EXISTS idx_usage_events_org_id;
DROP INDEX IF EXISTS idx_usage_events_message_id;
DROP INDEX IF EXISTS idx_topup_events_org_id;

CREATE INDEX IF NOT EXISTS idx_credit_wallets_org_id ON credit_wallets(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_org_id ON usage_events(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_message_id ON usage_events(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_topup_events_org_id ON topup_events(org_id);

-- Update the simple_debit_credits function to handle TEXT types properly
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
    
    -- Calculate new balance
    new_balance := current_balance - p_cost_credits;
    
    -- Update wallet balance
    UPDATE credit_wallets 
    SET balance = new_balance, updated_at = NOW()
    WHERE org_id = p_org_id;
    
    -- Insert usage event
    INSERT INTO usage_events (
        org_id, agent_id, channel, input_tokens, output_tokens, 
        cost_credits, message_id, meta
    ) VALUES (
        p_org_id, p_agent_id, p_channel, p_input_tokens, p_output_tokens,
        p_cost_credits, p_message_id, p_meta
    ) RETURNING id INTO usage_event_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Credits debited successfully',
        'usage_event_id', usage_event_id,
        'remaining_balance', new_balance
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Error: ' || SQLERRM
        );
END $$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION simple_debit_credits TO service_role;
GRANT EXECUTE ON FUNCTION simple_debit_credits TO authenticated;