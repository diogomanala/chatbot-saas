-- Script para corrigir definitivamente o sistema de cobrança
-- Executa diretamente no banco remoto via Supabase SQL Editor

-- 1. Primeiro, vamos dropar e recriar as políticas que impedem alterações
DROP POLICY IF EXISTS "Users can view own org wallet" ON credit_wallets;
DROP POLICY IF EXISTS "Service role can insert usage events" ON usage_events;
DROP POLICY IF EXISTS "Users can view their organization's usage events" ON usage_events;
DROP POLICY IF EXISTS "Service role can insert credit wallets" ON credit_wallets;
DROP POLICY IF EXISTS "Users can view their organization's credit wallet" ON credit_wallets;
DROP POLICY IF EXISTS "Super admins can view all topup events" ON topup_events;

-- 2. Corrigir tipos das colunas na tabela usage_events
ALTER TABLE usage_events 
  ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT,
  ALTER COLUMN agent_id TYPE TEXT USING agent_id::TEXT,
  ALTER COLUMN message_id TYPE TEXT USING message_id::TEXT;

-- 3. Corrigir tipos das colunas na tabela credit_wallets
ALTER TABLE credit_wallets 
  ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;

-- 4. Garantir que todas as colunas necessárias existem na usage_events
ALTER TABLE usage_events 
  ADD COLUMN IF NOT EXISTS channel TEXT CHECK (channel IN ('web', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS cost_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

-- 5. Recriar as políticas com os tipos corretos
CREATE POLICY "Users can view own org wallet" ON credit_wallets
  FOR SELECT USING (org_id = auth.jwt() ->> 'org_id');

CREATE POLICY "Service role can insert usage events" ON usage_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their organization's usage events" ON usage_events
  FOR SELECT USING (org_id = auth.jwt() ->> 'org_id');

CREATE POLICY "Service role can insert credit wallets" ON credit_wallets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their organization's credit wallet" ON credit_wallets
  FOR SELECT USING (org_id = auth.jwt() ->> 'org_id');

-- 6. Habilitar RLS nas tabelas
ALTER TABLE credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- 7. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_usage_events_org_id ON usage_events(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_agent_id ON usage_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_message_id ON usage_events(message_id);
CREATE INDEX IF NOT EXISTS idx_credit_wallets_org_id ON credit_wallets(org_id);

-- 8. Verificar se tudo está funcionando
SELECT 'usage_events structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'usage_events' 
ORDER BY ordinal_position;

SELECT 'credit_wallets structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'credit_wallets' 
ORDER BY ordinal_position;

SELECT 'Policies on usage_events:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'usage_events';

SELECT 'Policies on credit_wallets:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'credit_wallets';