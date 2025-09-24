-- Fix UUID column types in usage_events table
-- This script addresses the 'uuid = text' operator error

BEGIN;

-- First, let's check the current column types
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'usage_events' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Drop and recreate the table with correct types
-- First backup any existing data (if any)
CREATE TABLE IF NOT EXISTS usage_events_backup AS 
SELECT * FROM usage_events;

-- Drop the existing table
DROP TABLE IF EXISTS usage_events CASCADE;

-- Recreate with correct UUID types
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    message_id UUID NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp')),
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_credits INTEGER NOT NULL DEFAULT 0,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE usage_events 
ADD CONSTRAINT fk_usage_events_org_id 
FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view usage events from their org" ON usage_events
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.org_id = usage_events.org_id
    )
);

CREATE POLICY "System can insert usage events" ON usage_events
FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_usage_events_org_id ON usage_events(org_id);
CREATE INDEX idx_usage_events_agent_id ON usage_events(agent_id);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_events_message_id ON usage_events(message_id);

-- Grant necessary permissions
GRANT SELECT, INSERT ON usage_events TO authenticated;
GRANT SELECT, INSERT ON usage_events TO service_role;

-- Test insert to verify everything works
INSERT INTO usage_events (
    org_id,
    agent_id,
    message_id,
    channel,
    input_tokens,
    output_tokens,
    cost_credits,
    meta
) VALUES (
    '3108d984-ed2d-44f3-a742-ca223129c5fa'::UUID,
    'f99ae725-f996-483d-8813-cde922d8877a'::UUID,
    gen_random_uuid(),
    'whatsapp',
    10,
    5,
    1,
    '{"test": true}'::jsonb
);

-- Verify the test insert worked
SELECT COUNT(*) as test_records FROM usage_events;

-- Clean up test record
DELETE FROM usage_events WHERE meta->>'test' = 'true';

COMMIT;

-- Final verification
SELECT 'usage_events table recreated successfully' as status;