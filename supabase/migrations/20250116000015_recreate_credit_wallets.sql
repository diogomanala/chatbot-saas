-- Recreate credit_wallets table completely with correct types
-- This should resolve the UUID = TEXT issue once and for all

DO $$
BEGIN
    -- Check if credit_wallets table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_wallets') THEN
        
        -- Backup existing data if any
        CREATE TEMP TABLE credit_wallets_backup AS 
        SELECT org_id::text, balance, created_at, updated_at 
        FROM credit_wallets;
        
        RAISE NOTICE 'Backed up % rows from credit_wallets', (SELECT COUNT(*) FROM credit_wallets_backup);
        
        -- Drop the problematic table completely
        DROP TABLE credit_wallets CASCADE;
        
        RAISE NOTICE 'Dropped credit_wallets table';
        
    END IF;
    
    -- Create the table with correct types from scratch
    CREATE TABLE credit_wallets (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id TEXT NOT NULL UNIQUE,
        balance INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    RAISE NOTICE 'Created new credit_wallets table with TEXT types';
    
    -- Create index for performance
    CREATE INDEX idx_credit_wallets_org_id ON credit_wallets(org_id);
    
    -- Restore data if backup exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_wallets_backup') THEN
        INSERT INTO credit_wallets (org_id, balance, created_at, updated_at)
        SELECT org_id, balance, created_at, updated_at
        FROM credit_wallets_backup;
        
        RAISE NOTICE 'Restored % rows to new credit_wallets table', (SELECT COUNT(*) FROM credit_wallets);
    END IF;
    
    -- Test basic operations
    DELETE FROM credit_wallets WHERE org_id = 'recreate-test';
    
    INSERT INTO credit_wallets (org_id, balance) 
    VALUES ('recreate-test', 1000);
    
    UPDATE credit_wallets 
    SET balance = 2000 
    WHERE org_id = 'recreate-test';
    
    DELETE FROM credit_wallets WHERE org_id = 'recreate-test';
    
    RAISE NOTICE 'credit_wallets table recreated successfully';
    
END $$;