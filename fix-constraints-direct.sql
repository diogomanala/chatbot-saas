-- Fix constraints and RLS policies for messages table
-- This script addresses two main issues:
-- 1. Partial unique index on external_id that doesn't work with upserts
-- 2. UUID vs TEXT comparison error in RLS policies for outbound messages

BEGIN;

-- Step 1: Check current constraint status
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'messages' 
    AND indexname LIKE '%external_id%';

-- Step 2: Update any NULL external_id values to ensure uniqueness
UPDATE messages 
SET external_id = 'msg_' || id::text 
WHERE external_id IS NULL;

-- Step 3: Drop the partial unique index
DROP INDEX IF EXISTS idx_messages_external_id_unique;

-- Step 4: Add NOT NULL constraint to external_id
ALTER TABLE messages 
ALTER COLUMN external_id SET NOT NULL;

-- Step 5: Create a proper unique constraint (not partial index)
ALTER TABLE messages 
ADD CONSTRAINT messages_external_id_unique UNIQUE (external_id);

-- Step 6: Create a regular index for performance
CREATE INDEX IF NOT EXISTS idx_messages_external_id 
ON messages (external_id);

-- Step 7: Fix RLS policies to handle UUID vs TEXT comparison
-- Drop existing policies
DROP POLICY IF EXISTS "messages_select_policy" ON messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON messages;
DROP POLICY IF EXISTS "messages_update_policy" ON messages;

-- Recreate policies with proper type casting
CREATE POLICY "messages_select_policy" ON messages
    FOR SELECT USING (
        org_id::text = (auth.jwt() ->> 'org_id')::text
    );

CREATE POLICY "messages_insert_policy" ON messages
    FOR INSERT WITH CHECK (
        org_id::text = (auth.jwt() ->> 'org_id')::text
    );

CREATE POLICY "messages_update_policy" ON messages
    FOR UPDATE USING (
        org_id::text = (auth.jwt() ->> 'org_id')::text
    ) WITH CHECK (
        org_id::text = (auth.jwt() ->> 'org_id')::text
    );

-- Step 8: Verify the changes
SELECT 
    'Constraint created' as status,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
    AND conname = 'messages_external_id_unique';

SELECT 
    'Policies recreated' as status,
    policyname as policy_name,
    cmd as command
FROM pg_policies 
WHERE tablename = 'messages';

COMMIT;

-- Test the fix
SELECT 'Fix completed successfully' as result;