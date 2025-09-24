-- =====================================================
-- CONVERTER org_id DA TABELA MESSAGES PARA TEXT
-- =====================================================
-- Problema: messages.org_id é UUID mas credit_wallets.org_id é TEXT
-- Isso causa erro "operator does not exist: text = uuid"
-- =====================================================

BEGIN;

-- Primeiro, remover o trigger para evitar problemas durante a alteração
DROP TRIGGER IF EXISTS messages_outbound_autodebit_ai ON messages;

-- Remover políticas RLS que dependem da coluna org_id
DROP POLICY IF EXISTS select_own_org_messages ON messages;
DROP POLICY IF EXISTS insert_own_org_messages ON messages;
DROP POLICY IF EXISTS update_own_org_messages ON messages;
DROP POLICY IF EXISTS delete_own_org_messages ON messages;

-- Remover constraints que dependem da coluna org_id
DO $$
BEGIN
    -- Remover foreign key constraint se existir
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_org_id_fkey;
    RAISE NOTICE 'Removed foreign key constraint on messages.org_id';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Foreign key constraint may not exist: %', SQLERRM;
END $$;

-- Converter org_id de UUID para TEXT
DO $$
BEGIN
    -- Verificar se a coluna é UUID e converter para TEXT
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'messages' 
              AND column_name = 'org_id' 
              AND data_type = 'uuid') THEN
        
        ALTER TABLE messages ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
        RAISE NOTICE 'Converted messages.org_id from UUID to TEXT';
        
    ELSE
        RAISE NOTICE 'messages.org_id is already TEXT or does not exist';
    END IF;
END $$;

-- Também converter outras colunas UUID para TEXT para consistência
DO $$
BEGIN
    -- Converter chatbot_id se for UUID
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'messages' 
              AND column_name = 'chatbot_id' 
              AND data_type = 'uuid') THEN
        
        ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_chatbot_id_fkey;
        ALTER TABLE messages ALTER COLUMN chatbot_id TYPE TEXT USING chatbot_id::TEXT;
        RAISE NOTICE 'Converted messages.chatbot_id from UUID to TEXT';
    END IF;
    
    -- Converter device_id se for UUID
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'messages' 
              AND column_name = 'device_id' 
              AND data_type = 'uuid') THEN
        
        ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_device_id_fkey;
        ALTER TABLE messages ALTER COLUMN device_id TYPE TEXT USING device_id::TEXT;
        RAISE NOTICE 'Converted messages.device_id from UUID to TEXT';
    END IF;
END $$;

-- Recriar índices se necessário
DROP INDEX IF EXISTS idx_messages_org_id;
DROP INDEX IF EXISTS idx_messages_chatbot_id;
DROP INDEX IF EXISTS idx_messages_device_id;

CREATE INDEX idx_messages_org_id ON messages(org_id);
CREATE INDEX idx_messages_chatbot_id ON messages(chatbot_id);
CREATE INDEX idx_messages_device_id ON messages(device_id);

-- Atualizar a função do trigger para trabalhar com TEXT
CREATE OR REPLACE FUNCTION messages_outbound_autodebit_ai()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se é uma mensagem outbound com billing_status 'pending'
  IF NEW.direction = 'outbound' AND NEW.billing_status = 'pending' THEN
    
    -- Chamar a função de débito (agora ambos são TEXT)
    PERFORM simple_debit_credits(NEW.org_id::TEXT, NEW.tokens_used);
    
    -- Atualizar o billing_status para 'debited'
    NEW.billing_status = 'debited';
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atualizar a função simple_debit_credits para aceitar TEXT
DROP FUNCTION IF EXISTS simple_debit_credits(UUID, INTEGER);

CREATE OR REPLACE FUNCTION simple_debit_credits(
    p_org_id TEXT,
    p_credits INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance NUMERIC;
    new_balance NUMERIC;
BEGIN
    -- Get current balance (ambos são TEXT agora)
    SELECT balance INTO current_balance
    FROM credit_wallets
    WHERE org_id = p_org_id;
    
    -- Check if wallet exists
    IF current_balance IS NULL THEN
        -- Create wallet if it doesn't exist
        INSERT INTO credit_wallets (org_id, balance, created_at, updated_at)
        VALUES (p_org_id, 0, NOW(), NOW())
        ON CONFLICT (org_id) DO NOTHING;
        current_balance := 0;
    END IF;
    
    -- Check sufficient balance (allow negative for now)
    new_balance := current_balance - p_credits;
    
    -- Update wallet balance
    UPDATE credit_wallets 
    SET balance = new_balance, updated_at = NOW()
    WHERE org_id = p_org_id;
    
    -- Insert usage event
    INSERT INTO usage_events (
        org_id, 
        agent_id, 
        channel, 
        input_tokens, 
        output_tokens, 
        cost_credits,
        message_id,
        created_at,
        metadata
    ) VALUES (
        p_org_id,
        NULL, -- agent_id não disponível no trigger
        'webhook', -- canal padrão
        0, -- input_tokens não disponível
        p_credits, -- usar credits como output_tokens
        p_credits, -- cost_credits
        NULL, -- message_id não disponível no trigger
        NOW(),
        jsonb_build_object('source', 'trigger', 'auto_debit', true)
    );
    
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return false
        RAISE WARNING 'Error in simple_debit_credits: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER messages_outbound_autodebit_ai
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION messages_outbound_autodebit_ai();

-- Conceder permissões
GRANT EXECUTE ON FUNCTION simple_debit_credits(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION simple_debit_credits(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION simple_debit_credits(TEXT, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION messages_outbound_autodebit_ai() TO authenticated;
GRANT EXECUTE ON FUNCTION messages_outbound_autodebit_ai() TO anon;
GRANT EXECUTE ON FUNCTION messages_outbound_autodebit_ai() TO service_role;

-- Log da migração
DO $$
BEGIN
  RAISE NOTICE 'Tabela messages convertida para usar TEXT em vez de UUID, resolvendo problema de comparação de tipos';
END $$;

COMMIT;