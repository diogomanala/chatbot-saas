-- Migration: Add updated_at column to messages table
-- Description: Adds updated_at column with automatic trigger for timestamp updates
-- Date: 2025-01-24

-- Step 1: Add the updated_at column to the messages table
ALTER TABLE public.messages 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Populate existing records with created_at value to avoid null values
UPDATE public.messages 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Step 3: Create function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 4: Create trigger to automatically update updated_at on row updates
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Step 5: Set default value for new records (optional but recommended)
ALTER TABLE public.messages 
ALTER COLUMN updated_at SET DEFAULT NOW();

-- Step 6: Add comment for documentation
COMMENT ON COLUMN public.messages.updated_at IS 'Timestamp of last update, automatically maintained by trigger';
COMMENT ON FUNCTION public.update_updated_at_column() IS 'Function to automatically update updated_at column on row updates';
COMMENT ON TRIGGER update_messages_updated_at ON public.messages IS 'Trigger to automatically update updated_at column before each update';