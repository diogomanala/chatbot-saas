-- Adicionar colunas que estão faltando na tabela messages

-- Adicionar coluna external_id se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'external_id') THEN
        ALTER TABLE public.messages ADD COLUMN external_id text;
    END IF;
END $$;

-- Adicionar coluna content se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'content') THEN
        ALTER TABLE public.messages ADD COLUMN content text;
    END IF;
END $$;

-- Adicionar coluna direction se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'direction') THEN
        -- Criar enum se não existir
        DO $enum$ BEGIN
            CREATE TYPE public.msg_direction AS ENUM ('inbound','outbound');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $enum$;
        
        ALTER TABLE public.messages ADD COLUMN direction public.msg_direction;
    END IF;
END $$;

-- Adicionar coluna sender_phone se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'sender_phone') THEN
        ALTER TABLE public.messages ADD COLUMN sender_phone text;
    END IF;
END $$;

-- Adicionar coluna receiver_phone se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'receiver_phone') THEN
        ALTER TABLE public.messages ADD COLUMN receiver_phone text;
    END IF;
END $$;

-- Adicionar coluna status se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'status') THEN
        ALTER TABLE public.messages ADD COLUMN status text NOT NULL DEFAULT 'received';
    END IF;
END $$;

-- Adicionar coluna tokens_used se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'tokens_used') THEN
        ALTER TABLE public.messages ADD COLUMN tokens_used int DEFAULT 0;
    END IF;
END $$;

-- Adicionar coluna metadata se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'metadata') THEN
        ALTER TABLE public.messages ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
    END IF;
END $$;

-- Criar índice único para external_id se não existir
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_id_unique
  ON public.messages (external_id)
  WHERE external_id IS NOT NULL;