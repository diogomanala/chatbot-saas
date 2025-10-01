-- Fix credit_wallets id column to be TEXT instead of UUID
-- This resolves the "operator does not exist: uuid = text" error

DO $$ 
BEGIN
    -- Check if credit_wallets table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_wallets') THEN
        
        -- Check if id column is UUID and convert to TEXT
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'credit_wallets' 
                  AND column_name = 'id' 
                  AND data_type = 'uuid') THEN
            
            -- Drop any constraints that might depend on the id column
            ALTER TABLE credit_wallets DROP CONSTRAINT IF EXISTS credit_wallets_pkey;
            
            -- Convert id column from UUID to TEXT
            ALTER TABLE credit_wallets ALTER COLUMN id TYPE TEXT USING id::TEXT;
            
            -- Re-add primary key constraint
            ALTER TABLE credit_wallets ADD CONSTRAINT credit_wallets_pkey PRIMARY KEY (id);
            
            RAISE NOTICE 'credit_wallets.id column converted from UUID to TEXT';
        ELSE
            RAISE NOTICE 'credit_wallets.id column is already TEXT or does not exist';
        END IF;
        
        -- Also ensure org_id is TEXT (should already be done by previous migrations)
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'credit_wallets' 
                  AND column_name = 'org_id' 
                  AND data_type = 'uuid') THEN
            ALTER TABLE credit_wallets ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
            RAISE NOTICE 'credit_wallets.org_id column converted from UUID to TEXT';
        END IF;
        
    ELSE
        RAISE NOTICE 'credit_wallets table does not exist';
    END IF;
END $$;

-- Test the fix by attempting an insert and update
DO $$
BEGIN
    -- Clean up any test data first
    DELETE FROM credit_wallets WHERE org_id = 'test-fix-org';
    
    -- Insert test record
    INSERT INTO credit_wallets (id, org_id, balance) 
    VALUES ('test-fix-id', 'test-fix-org', 1000);
    
    -- Update test record (this should work now)
    UPDATE credit_wallets 
    SET balance = 2000 
    WHERE org_id = 'test-fix-org';
    
    -- Clean up test data
    DELETE FROM credit_wallets WHERE org_id = 'test-fix-org';
    
    RAISE NOTICE 'credit_wallets table operations test completed successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test failed: %', SQLERRM;
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';