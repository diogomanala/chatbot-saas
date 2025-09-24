-- Ensure idempotency and consistent lookups for WhatsApp integration
-- 1) Make messages.external_id unique (only for non-null values)
-- 2) Make devices.session_name globally unique

-- Safeguard: only create indexes if the target tables exist
DO $$
BEGIN
  -- Unique external_id on messages (partial: only when not null)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_id_unique
      ON public.messages (external_id)
      WHERE external_id IS NOT NULL;
  END IF;

  -- Unique session_name on devices (global uniqueness)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'devices'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_session_name_unique
      ON public.devices (session_name);
  END IF;
END $$;