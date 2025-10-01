-- Fix external_id constraint and RLS policies for messages table
-- This migration addresses:
-- 1. Partial unique index on external_id that doesn't work with upserts
-- 2. UUID vs TEXT comparison error in RLS policies

-- Step 1: Update any NULL external_id values to ensure uniqueness
UPDATE messages 
SET external_id = 'msg_' || id::text 
WHERE external_id IS NULL;

-- Step 2: Drop the partial unique index if it exists
DROP INDEX IF EXISTS idx_messages_external_id_unique;

-- Step 3: Add NOT NULL constraint to external_id
ALTER TABLE messages 
ALTER COLUMN external_id SET NOT NULL;

-- Step 4: Create a proper unique constraint (not partial index) if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'messages_external_id_unique' 
        AND conrelid = 'messages'::regclass
    ) THEN
        ALTER TABLE messages 
        ADD CONSTRAINT messages_external_id_unique UNIQUE (external_id);
    END IF;
END $$;

-- Step 5: Create a regular index for performance
CREATE INDEX IF NOT EXISTS idx_messages_external_id 
ON messages (external_id);

-- Step 6: Fix RLS policies to handle UUID vs TEXT comparison
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