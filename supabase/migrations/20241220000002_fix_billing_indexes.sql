-- Fix billing tables indexes and ensure proper structure

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_credit_wallets_orgid;
DROP INDEX IF EXISTS idx_usage_events_orgid;
DROP INDEX IF EXISTS idx_usage_events_messageid;
DROP INDEX IF EXISTS idx_usage_events_created_at;
DROP INDEX IF EXISTS idx_topup_events_orgid;
DROP INDEX IF EXISTS idx_topup_events_created_at;

-- Ensure credit_wallets table has correct structure
DO $$
BEGIN
    -- Add org_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_wallets' AND column_name = 'org_id') THEN
        ALTER TABLE credit_wallets ADD COLUMN org_id TEXT NOT NULL;
    END IF;
    
    -- Add balance column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_wallets' AND column_name = 'balance') THEN
        ALTER TABLE credit_wallets ADD COLUMN balance INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    -- Add currency column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_wallets' AND column_name = 'currency') THEN
        ALTER TABLE credit_wallets ADD COLUMN currency TEXT NOT NULL DEFAULT 'BRL';
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_wallets' AND column_name = 'updated_at') THEN
        ALTER TABLE credit_wallets ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Ensure usage_events table exists with correct structure
CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    agent_id TEXT,
    channel TEXT CHECK (channel IN ('web', 'whatsapp')),
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_credits INTEGER NOT NULL DEFAULT 0,
    message_id TEXT,
    meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure topup_events table exists with correct structure
CREATE TABLE IF NOT EXISTS topup_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    added_credits INTEGER NOT NULL,
    reason TEXT,
    performed_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes with proper column names
CREATE INDEX IF NOT EXISTS idx_credit_wallets_org_id ON credit_wallets(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_org_id ON usage_events(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_message_id ON usage_events(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topup_events_org_id ON topup_events(org_id);
CREATE INDEX IF NOT EXISTS idx_topup_events_created_at ON topup_events(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE topup_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for credit_wallets
DROP POLICY IF EXISTS "Users can view their organization's credit wallet" ON credit_wallets;
CREATE POLICY "Users can view their organization's credit wallet" ON credit_wallets
    FOR SELECT USING (
        org_id::text IN (
            SELECT org_id::text FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Super admins can view all credit wallets" ON credit_wallets;
CREATE POLICY "Super admins can view all credit wallets" ON credit_wallets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Create RLS policies for usage_events
DROP POLICY IF EXISTS "Users can view their organization's usage events" ON usage_events;
CREATE POLICY "Users can view their organization's usage events" ON usage_events
    FOR SELECT USING (
        org_id::text IN (
            SELECT org_id::text FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Super admins can view all usage events" ON usage_events;
CREATE POLICY "Super admins can view all usage events" ON usage_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Create RLS policies for topup_events
DROP POLICY IF EXISTS "Users can view their organization's topup events" ON topup_events;
CREATE POLICY "Users can view their organization's topup events" ON topup_events
    FOR SELECT USING (
        org_id::text IN (
            SELECT org_id::text FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Super admins can manage all topup events" ON topup_events;
CREATE POLICY "Super admins can manage all topup events" ON topup_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Create function to update credit wallet balance
CREATE OR REPLACE FUNCTION update_credit_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE credit_wallets 
    SET updated_at = NOW()
    WHERE org_id = NEW.org_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_wallet_on_usage ON usage_events;
CREATE TRIGGER trigger_update_wallet_on_usage
    AFTER INSERT ON usage_events
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_wallet_balance();

DROP TRIGGER IF EXISTS trigger_update_wallet_on_topup ON topup_events;
CREATE TRIGGER trigger_update_wallet_on_topup
    AFTER INSERT ON topup_events
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_wallet_balance();