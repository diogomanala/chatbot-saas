-- Tabela específica para cobrança de mensagens
CREATE TABLE IF NOT EXISTS message_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL, -- Usando TEXT para compatibilidade
  tokens_used INTEGER NOT NULL DEFAULT 0,
  credits_charged DECIMAL(10,4) NOT NULL DEFAULT 0,
  billing_status TEXT NOT NULL DEFAULT 'pending' CHECK (billing_status IN ('pending', 'charged', 'failed')),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_message_billing_org_id ON message_billing(org_id);
CREATE INDEX IF NOT EXISTS idx_message_billing_status ON message_billing(billing_status);
CREATE INDEX IF NOT EXISTS idx_message_billing_message_id ON message_billing(message_id);
CREATE INDEX IF NOT EXISTS idx_message_billing_created_at ON message_billing(created_at);

-- Tabela simplificada para saldos de créditos (sem UUID)
CREATE TABLE IF NOT EXISTS organization_credits (
  id SERIAL PRIMARY KEY,
  org_id TEXT NOT NULL UNIQUE, -- Usando TEXT para compatibilidade
  balance DECIMAL(10,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para org_id
CREATE INDEX IF NOT EXISTS idx_organization_credits_org_id ON organization_credits(org_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_message_billing_updated_at BEFORE UPDATE ON message_billing FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organization_credits_updated_at BEFORE UPDATE ON organization_credits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir saldo inicial para organizações existentes (se não existir)
INSERT INTO organization_credits (org_id, balance)
SELECT DISTINCT org_id, 1000.0 -- Saldo inicial de 1000 créditos
FROM messages 
WHERE org_id NOT IN (SELECT org_id FROM organization_credits)
ON CONFLICT (org_id) DO NOTHING;

COMMIT;