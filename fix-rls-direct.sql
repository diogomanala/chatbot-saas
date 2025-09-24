-- Fix RLS policies for messages table
-- This script will be executed directly on the database

-- First, disable RLS temporarily to allow operations
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "messages_select_policy" ON messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON messages;
DROP POLICY IF EXISTS "messages_update_policy" ON messages;
DROP POLICY IF EXISTS "select_own_org_messages" ON messages;
DROP POLICY IF EXISTS "insert_own_org_messages" ON messages;
DROP POLICY IF EXISTS "update_own_org_messages" ON messages;
DROP POLICY IF EXISTS "delete_own_org_messages" ON messages;
DROP POLICY IF EXISTS "service_role_full_access" ON messages;
DROP POLICY IF EXISTS "authenticated_read_all" ON messages;
DROP POLICY IF EXISTS "authenticated_insert" ON messages;
DROP POLICY IF EXISTS "authenticated_update" ON messages;

-- Create simple policies that allow service role to do everything
CREATE POLICY "service_role_full_access" ON messages
    FOR ALL USING (auth.role() = 'service_role');

-- Create policies for authenticated users (for dashboard access)
CREATE POLICY "authenticated_read_all" ON messages
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert" ON messages
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "authenticated_update" ON messages
    FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Re-enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'messages';