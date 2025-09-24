-- =====================================================
-- CORREÇÃO DEFINITIVA DO TRIGGER - COMPARAÇÃO UUID
-- =====================================================
-- Este arquivo corrige o problema de comparação text = uuid
-- no trigger messages_outbound_autodebit_ai
-- =====================================================

-- Primeiro, remover o trigger existente se houver
DROP TRIGGER IF EXISTS messages_outbound_autodebit_ai ON messages;

-- Remover a função do trigger existente se houver
DROP FUNCTION IF EXISTS messages_outbound_autodebit_ai();

-- Criar nova função do trigger com conversão adequada de tipos
CREATE OR REPLACE FUNCTION messages_outbound_autodebit_ai()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se é uma mensagem outbound com billing_status 'pending'
  IF NEW.direction = 'outbound' AND NEW.billing_status = 'pending' THEN
    
    -- Chamar a função de débito convertendo org_id para UUID
    PERFORM simple_debit_credits(NEW.org_id::uuid, NEW.tokens_used);
    
    -- Atualizar o billing_status para 'debited'
    NEW.billing_status = 'debited';
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger
CREATE TRIGGER messages_outbound_autodebit_ai
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION messages_outbound_autodebit_ai();

-- Conceder permissões
GRANT EXECUTE ON FUNCTION messages_outbound_autodebit_ai() TO authenticated;
GRANT EXECUTE ON FUNCTION messages_outbound_autodebit_ai() TO anon;
GRANT EXECUTE ON FUNCTION messages_outbound_autodebit_ai() TO service_role;

-- Log da migração
DO $$
BEGIN
  RAISE NOTICE 'Trigger messages_outbound_autodebit_ai corrigido com conversão UUID adequada';
END $$;