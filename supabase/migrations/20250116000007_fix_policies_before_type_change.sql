-- Remove policies that prevent column type changes
-- This must run before changing UUID to TEXT types

BEGIN;

-- Drop policies on usage_ledger that depend on org_id column
DROP POLICY IF EXISTS "Users can insert own org usage" ON usage_ledger;
DROP POLICY IF EXISTS "Users can view own org usage" ON usage_ledger;
DROP POLICY IF EXISTS "Super admins can view all usage" ON usage_ledger;
DROP POLICY IF EXISTS "Service role can manage all usage" ON usage_ledger;

-- Drop policies on other tables that might conflict
DROP POLICY IF EXISTS "Users can view their organization's usage events" ON usage_events;
DROP POLICY IF EXISTS "Service role can insert usage events" ON usage_events;
DROP POLICY IF EXISTS "Users can view their organization's credit wallet" ON credit_wallets;
DROP POLICY IF EXISTS "Service role can insert credit wallets" ON credit_wallets;
DROP POLICY IF EXISTS "Users can view their organization's topup events" ON topup_events;
DROP POLICY IF EXISTS "Super admins can view all topup events" ON topup_events;

-- Temporarily disable RLS to allow type changes
ALTER TABLE usage_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE topup_events DISABLE ROW LEVEL SECURITY;

COMMIT;