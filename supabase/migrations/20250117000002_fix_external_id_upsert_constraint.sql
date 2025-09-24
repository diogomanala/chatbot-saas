-- =====================================================
-- MIGRAÇÃO: Corrigir UPSERT na tabela messages
-- =====================================================
-- Problema: O índice UNIQUE parcial não funciona com ON CONFLICT
-- Solução: Criar constraint UNIQUE completa na coluna external_id
-- =====================================================

-- Step 1: Remove the existing partial unique index (if exists)
-- This index only covers rows WHERE external_id IS NOT NULL
-- which doesn't work with ON CONFLICT operations
DROP INDEX IF EXISTS messages_external_id_unique_idx;

-- Step 2: Create a proper UNIQUE constraint on external_id column (if not exists)
-- This will work with ON CONFLICT in UPSERT operations
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'messages_external_id_unique' 
        AND conrelid = 'messages'::regclass
    ) THEN
        ALTER TABLE messages
        ADD CONSTRAINT messages_external_id_unique
        UNIQUE (external_id);
    END IF;
END $$;

-- Step 3: Create a regular index for performance (optional but recommended)
-- This helps with queries that filter by external_id
CREATE INDEX IF NOT EXISTS messages_external_id_idx 
ON messages (external_id);