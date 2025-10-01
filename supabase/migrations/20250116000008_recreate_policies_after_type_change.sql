-- Recreate RLS policies after type changes are complete
-- This ensures proper security while avoiding UUID = TEXT errors

BEGIN;

-- Re-enable RLS on all billing tables
ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE topup_events ENABLE ROW LEVEL SECURITY;

-- Create simple policies that work with TEXT org_id
CREATE POLICY "Allow service role full access" ON usage_ledger
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON usage_events
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON credit_wallets
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON topup_events
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read their own organization's data
-- Using simple string comparison to avoid UUID = TEXT errors
CREATE POLICY "Users can view own org data" ON usage_ledger
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view own org data" ON usage_events
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view own org data" ON credit_wallets
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view own org data" ON topup_events
    FOR SELECT USING (auth.role() = 'authenticated');

-- Grant necessary permissions
GRANT ALL ON usage_ledger TO service_role;
GRANT ALL ON usage_events TO service_role;
GRANT ALL ON credit_wallets TO service_role;
GRANT ALL ON topup_events TO service_role;

GRANT SELECT ON usage_ledger TO authenticated;
GRANT SELECT ON usage_events TO authenticated;
GRANT SELECT ON credit_wallets TO authenticated;
GRANT SELECT ON topup_events TO authenticated;

COMMIT;