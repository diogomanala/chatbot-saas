-- Fix external_id constraint for upsert operations
-- The partial unique index doesn't work with ON CONFLICT, we need a proper constraint

-- Step 1: Drop the existing partial unique index
DROP INDEX IF EXISTS idx_messages_external_id_unique;

-- Step 2: Update any NULL external_id values to ensure uniqueness
-- Generate unique external_id for messages that don't have one
UPDATE messages 
SET external_id = 'msg_' || id::text 
WHERE external_id IS NULL;

-- Step 3: Make external_id NOT NULL to prevent future NULL values
ALTER TABLE messages 
ALTER COLUMN external_id SET NOT NULL;

-- Step 4: Add a proper unique constraint (not partial index)
ALTER TABLE messages 
ADD CONSTRAINT messages_external_id_unique UNIQUE (external_id);

-- Step 5: Create an index for performance (optional, but recommended)
CREATE INDEX IF NOT EXISTS idx_messages_external_id 
ON messages (external_id);

-- Verify the constraint was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'messages' 
    AND constraint_name = 'messages_external_id_unique'
    AND constraint_type = 'UNIQUE'
  ) THEN
    RAISE NOTICE 'SUCCESS: Unique constraint on external_id created successfully';
  ELSE
    RAISE NOTICE 'ERROR: Failed to create unique constraint on external_id';
  END IF;
END $$;