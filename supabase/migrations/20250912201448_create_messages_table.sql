-- Criar enum para direção da mensagem
DO $$ BEGIN
    CREATE TYPE public.msg_direction AS ENUM ('inbound','outbound');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar tabela messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  direction public.msg_direction NOT NULL,
  sender_phone text NOT NULL,
  receiver_phone text NOT NULL,
  content text,
  message_type text NOT NULL DEFAULT 'text',
  status text NOT NULL DEFAULT 'received',
  external_id text,
  tokens_used int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- Habilitar RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Política para visualizar mensagens da própria organização
DROP POLICY IF EXISTS "select_own_org_messages" ON public.messages;
CREATE POLICY "select_own_org_messages" ON public.messages FOR SELECT
  USING (EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.org_id = messages.org_id
  ));

-- Política para inserir mensagens na própria organização
DROP POLICY IF EXISTS "insert_own_org_messages" ON public.messages;
CREATE POLICY "insert_own_org_messages" ON public.messages FOR INSERT
  WITH CHECK (EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.org_id = messages.org_id
  ));

-- Política para atualizar mensagens da própria organização
DROP POLICY IF EXISTS "update_own_org_messages" ON public.messages;
CREATE POLICY "update_own_org_messages" ON public.messages FOR UPDATE
  USING (EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.org_id = messages.org_id
  ));