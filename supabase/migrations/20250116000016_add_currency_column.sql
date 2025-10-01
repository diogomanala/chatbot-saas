-- Add missing currency column to credit_wallets table

DO $$
BEGIN
    -- Check if credit_wallets table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_wallets') THEN
        
        -- Add currency column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'credit_wallets' 
                      AND column_name = 'currency') THEN
            
            ALTER TABLE credit_wallets ADD COLUMN currency TEXT DEFAULT 'BRL';
            
            RAISE NOTICE 'Added currency column to credit_wallets table';
        ELSE
            RAISE NOTICE 'Currency column already exists in credit_wallets table';
        END IF;
        
        -- Test basic operations with currency column
        DELETE FROM credit_wallets WHERE org_id = 'currency-test';
        
        INSERT INTO credit_wallets (org_id, balance, currency) 
        VALUES ('currency-test', 1000, 'BRL');
        
        UPDATE credit_wallets 
        SET balance = 2000, currency = 'USD' 
        WHERE org_id = 'currency-test';
        
        DELETE FROM credit_wallets WHERE org_id = 'currency-test';
        
        RAISE NOTICE 'Currency column added and tested successfully';
        
    ELSE
        RAISE NOTICE 'credit_wallets table does not exist';
    END IF;
END $$;