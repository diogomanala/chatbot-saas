-- Migration: Add credits to wallet function
-- Description: Creates a safe RPC function to add credits to a wallet
-- Date: 2025-01-24

-- Create function to safely add credits to wallet
CREATE OR REPLACE FUNCTION add_credits_to_wallet(
    p_org_id TEXT,
    p_amount INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_balance INT;
BEGIN
    -- Validate input parameters
    IF p_org_id IS NULL OR p_org_id = '' THEN
        RAISE EXCEPTION 'Organization ID cannot be null or empty';
    END IF;
    
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be a positive integer';
    END IF;
    
    -- Update the wallet balance atomically
    UPDATE public.credit_wallets 
    SET 
        balance = balance + p_amount,
        updated_at = NOW()
    WHERE org_id = p_org_id;
    
    -- Check if the update affected any rows
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for organization ID: %', p_org_id;
    END IF;
    
    -- Get the new balance
    SELECT balance INTO new_balance
    FROM public.credit_wallets 
    WHERE org_id = p_org_id;
    
    -- Return the new balance
    RETURN new_balance;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_credits_to_wallet(TEXT, INT) TO authenticated;

-- Add comment to the function
COMMENT ON FUNCTION add_credits_to_wallet(TEXT, INT) IS 'Safely adds credits to a wallet and returns the new balance';