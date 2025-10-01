-- Manual fix for UUID = TEXT error in usage_events
-- Run this in Supabase SQL Editor

-- Step 1: Disable RLS
ALTER TABLE usage_events DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies
DROP POLICY IF EXISTS "Users can view their organization's usage events" ON usage_events;
DROP POLICY IF EXISTS "Super admins can view all usage events" ON usage_events;
DROP POLICY IF EXISTS "Users can view their org's usage events" ON usage_events;
DROP POLICY IF EXISTS "Service role can manage all usage events" ON usage_events;

-- Step 3: Ensure all UUID columns are TEXT type
ALTER TABLE usage_events ALTER COLUMN org_id TYPE TEXT;
ALTER TABLE usage_events ALTER COLUMN agent_id TYPE TEXT;
ALTER TABLE usage_events ALTER COLUMN message_id TYPE TEXT;

-- Step 4: Create simple policies without UUID comparisons
CREATE POLICY "Allow all authenticated access" ON usage_events
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Step 5: Re-enable RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Step 6: Test insert
INSERT INTO usage_events (org_id, agent_id, message_id, channel, input_tokens, output_tokens, cost_credits)
VALUES ('test-org', 'test-agent', 'test-message', 'whatsapp', 1, 1, 1);

-- Step 7: Clean up test
DELETE FROM usage_events WHERE message_id = 'test-message';
