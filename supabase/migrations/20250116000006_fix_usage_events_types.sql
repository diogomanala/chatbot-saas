-- Fix usage_events table column types to match the application expectations
-- This migration ensures all ID columns are TEXT type to avoid UUID/TEXT conflicts

BEGIN;

-- First, check if usage_events table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_events') THEN
        -- Convert UUID columns to TEXT if they exist as UUID
        
        -- Fix org_id column
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'usage_events' 
                  AND column_name = 'org_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE usage_events ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
        END IF;
        
        -- Fix agent_id column
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'usage_events' 
                  AND column_name = 'agent_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE usage_events ALTER COLUMN agent_id TYPE TEXT USING agent_id::TEXT;
        END IF;
        
        -- Fix message_id column
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'usage_events' 
                  AND column_name = 'message_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE usage_events ALTER COLUMN message_id TYPE TEXT USING message_id::TEXT;
        END IF;
        
        -- Ensure the table has the correct structure
        -- Add missing columns if they don't exist
        
        -- Add channel column if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'usage_events' 
                      AND column_name = 'channel') THEN
            ALTER TABLE usage_events ADD COLUMN channel TEXT CHECK (channel IN ('web', 'whatsapp'));
        END IF;
        
        -- Add cost_credits column if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'usage_events' 
                      AND column_name = 'cost_credits') THEN
            ALTER TABLE usage_events ADD COLUMN cost_credits INTEGER NOT NULL DEFAULT 0;
        END IF;
        
        -- Add meta column if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'usage_events' 
                      AND column_name = 'meta') THEN
            ALTER TABLE usage_events ADD COLUMN meta JSONB DEFAULT '{}'::jsonb;
        END IF;
        
        RAISE NOTICE 'usage_events table structure updated successfully';
    ELSE
        RAISE NOTICE 'usage_events table does not exist, skipping migration';
    END IF;
END $$;

-- Also fix credit_wallets table if needed
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_wallets') THEN
        -- Fix org_id column in credit_wallets
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'credit_wallets' 
                  AND column_name = 'org_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE credit_wallets ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
        END IF;
        
        RAISE NOTICE 'credit_wallets table structure updated successfully';
    END IF;
END $$;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;