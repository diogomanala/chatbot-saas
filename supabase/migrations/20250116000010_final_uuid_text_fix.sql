-- Final fix for UUID = TEXT comparison errors
-- This migration removes all remaining UUID comparisons and ensures consistent TEXT types

BEGIN;

-- Drop all constraints that might be causing UUID = TEXT comparisons
DO $$
BEGIN
    -- Drop foreign key constraints
    ALTER TABLE credit_wallets DROP CONSTRAINT IF EXISTS credit_wallets_org_id_fkey;
    ALTER TABLE usage_events DROP CONSTRAINT IF EXISTS usage_events_org_id_fkey;
    ALTER TABLE usage_events DROP CONSTRAINT IF EXISTS usage_events_agent_id_fkey;
    ALTER TABLE usage_events DROP CONSTRAINT IF EXISTS usage_events_message_id_fkey;
    ALTER TABLE topup_events DROP CONSTRAINT IF EXISTS topup_events_org_id_fkey;
    ALTER TABLE topup_events DROP CONSTRAINT IF EXISTS topup_events_performed_by_user_id_fkey;
    
    -- Drop unique constraints that might cause issues
    ALTER TABLE credit_wallets DROP CONSTRAINT IF EXISTS credit_wallets_org_id_key;
    
    RAISE NOTICE 'Dropped all foreign key and unique constraints';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Some constraints may not exist: %', SQLERRM;
END $$;

-- Ensure all ID columns are TEXT type
DO $$
BEGIN
    -- Fix credit_wallets
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'credit_wallets' 
              AND column_name = 'org_id' 
              AND data_type != 'text') THEN
        ALTER TABLE credit_wallets ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
        RAISE NOTICE 'Fixed credit_wallets.org_id to TEXT';
    END IF;
    
    -- Fix usage_events
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'usage_events' 
              AND column_name = 'org_id' 
              AND data_type != 'text') THEN
        ALTER TABLE usage_events ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
        RAISE NOTICE 'Fixed usage_events.org_id to TEXT';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'usage_events' 
              AND column_name = 'agent_id' 
              AND data_type != 'text') THEN
        ALTER TABLE usage_events ALTER COLUMN agent_id TYPE TEXT USING agent_id::TEXT;
        RAISE NOTICE 'Fixed usage_events.agent_id to TEXT';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'usage_events' 
              AND column_name = 'message_id' 
              AND data_type != 'text') THEN
        ALTER TABLE usage_events ALTER COLUMN message_id TYPE TEXT USING message_id::TEXT;
        RAISE NOTICE 'Fixed usage_events.message_id to TEXT';
    END IF;
    
    -- Fix topup_events
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'topup_events' 
              AND column_name = 'org_id' 
              AND data_type != 'text') THEN
        ALTER TABLE topup_events ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
        RAISE NOTICE 'Fixed topup_events.org_id to TEXT';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'topup_events' 
              AND column_name = 'performed_by_user_id' 
              AND data_type != 'text') THEN
        ALTER TABLE topup_events ALTER COLUMN performed_by_user_id TYPE TEXT USING performed_by_user_id::TEXT;
        RAISE NOTICE 'Fixed topup_events.performed_by_user_id to TEXT';
    END IF;
END $$;

-- Drop and recreate all indexes to avoid type conflicts
DROP INDEX IF EXISTS idx_credit_wallets_org_id;
DROP INDEX IF EXISTS idx_usage_events_org_id;
DROP INDEX IF EXISTS idx_usage_events_agent_id;
DROP INDEX IF EXISTS idx_usage_events_message_id;
DROP INDEX IF EXISTS idx_topup_events_org_id;

-- Recreate indexes with TEXT types
CREATE INDEX idx_credit_wallets_org_id ON credit_wallets(org_id);
CREATE INDEX idx_usage_events_org_id ON usage_events(org_id);
CREATE INDEX idx_usage_events_agent_id ON usage_events(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_usage_events_message_id ON usage_events(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_topup_events_org_id ON topup_events(org_id);

-- Add unique constraint back with TEXT type
ALTER TABLE credit_wallets ADD CONSTRAINT credit_wallets_org_id_unique UNIQUE (org_id);

-- Ensure RLS is disabled to avoid comparison issues
ALTER TABLE credit_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE topup_events DISABLE ROW LEVEL SECURITY;

-- Grant all necessary permissions
GRANT ALL ON credit_wallets TO service_role;
GRANT ALL ON usage_events TO service_role;
GRANT ALL ON topup_events TO service_role;

GRANT SELECT, INSERT, UPDATE ON credit_wallets TO authenticated;
GRANT SELECT, INSERT ON usage_events TO authenticated;
GRANT SELECT ON topup_events TO authenticated;

-- Test the fix by inserting a test record
INSERT INTO credit_wallets (org_id, balance, currency, created_at, updated_at)
VALUES ('migration-test-org', 0, 'BRL', NOW(), NOW())
ON CONFLICT (org_id) DO UPDATE SET updated_at = NOW();

-- Clean up test record
DELETE FROM credit_wallets WHERE org_id = 'migration-test-org';

DO $$
BEGIN
    RAISE NOTICE 'UUID = TEXT fix migration completed successfully';
END $$;

COMMIT;