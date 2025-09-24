-- Migração da estrutura do banco de dados
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar colunas necessárias na tabela devices
ALTER TABLE devices ADD COLUMN IF NOT EXISTS instance_id TEXT UNIQUE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS phone_jid TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_devices_instance_id ON devices(instance_id);
CREATE INDEX IF NOT EXISTS idx_devices_session_name ON devices(session_name);
CREATE INDEX IF NOT EXISTS idx_devices_org_id ON devices(org_id);
CREATE INDEX IF NOT EXISTS idx_chatbots_is_default ON chatbots(is_default) WHERE is_default = true;

-- 3. Migrar session_name para instance_id onde necessário
UPDATE devices 
SET instance_id = session_name 
WHERE instance_id IS NULL AND session_name IS NOT NULL;

-- 4. Garantir que existe pelo menos um chatbot default ativo
-- (Verificar manualmente se necessário)

-- 5. Comentários sobre a estrutura
COMMENT ON COLUMN devices.instance_id IS 'ID único da instância Evolution (migrado de session_name)';
COMMENT ON COLUMN devices.phone_jid IS 'JID do telefone WhatsApp (ex: 5522997603813@s.whatsapp.net)';
COMMENT ON COLUMN devices.config IS 'Configurações específicas do device em formato JSON';