-- ============================================================================
-- SISTEMA DE COBRANÇA SIMPLIFICADO - VERSÃO FINAL
-- Status: debited (crédito já debitado) + tokens = 1
-- ============================================================================

-- 1. REMOVER TODOS OS TRIGGERS E FUNÇÕES COMPLEXAS
-- ============================================================================

-- Remover triggers existentes
DROP TRIGGER IF EXISTS messages_outbound_autodebit_ai ON messages;
DROP TRIGGER IF EXISTS messages_prevent_pending_bu ON messages;
DROP TRIGGER IF EXISTS enforce_simple_billing_trigger ON messages;

-- Remover funções relacionadas
DROP FUNCTION IF EXISTS messages_outbound_autodebit_ai();
DROP FUNCTION IF EXISTS messages_prevent_pending_bu();
DROP FUNCTION IF EXISTS simple_debit_credits(uuid, integer);
DROP FUNCTION IF EXISTS enforce_simple_billing();

-- 2. ATUALIZAR CONSTRAINT PARA ACEITAR APENAS 'debited'
-- ============================================================================

-- Remover constraint antiga
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_billing_status_check;

-- Criar nova constraint que aceita apenas 'debited'
ALTER TABLE messages ADD CONSTRAINT messages_billing_status_check 
CHECK (billing_status IN ('debited'));

-- 3. CORRIGIR TODAS AS MENSAGENS EXISTENTES
-- ============================================================================

-- Atualizar todas as mensagens outbound para o novo padrão
UPDATE messages 
SET 
    billing_status = 'debited',
    tokens_used = 1,
    cost_credits = 1,
    charged_at = COALESCE(charged_at, created_at)
WHERE direction = 'outbound';

-- Mensagens inbound não precisam de cobrança
UPDATE messages 
SET 
    billing_status = 'debited',
    tokens_used = 0,
    cost_credits = 0,
    charged_at = NULL
WHERE direction = 'inbound';

-- 4. CRIAR TRIGGER SIMPLES PARA GARANTIR A REGRA
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_simple_billing()
RETURNS TRIGGER AS $$
BEGIN
    -- Para mensagens outbound: sempre debited + tokens = 1
    IF NEW.direction = 'outbound' THEN
        NEW.billing_status := 'debited';
        NEW.tokens_used := 1;
        NEW.cost_credits := 1;
        NEW.charged_at := COALESCE(NEW.charged_at, NOW());
    -- Para mensagens inbound: sempre debited + tokens = 0
    ELSE
        NEW.billing_status := 'debited';
        NEW.tokens_used := 0;
        NEW.cost_credits := 0;
        NEW.charged_at := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger que aplica a regra em INSERT e UPDATE
CREATE TRIGGER enforce_simple_billing_trigger
    BEFORE INSERT OR UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION enforce_simple_billing();

-- 5. VERIFICAÇÕES E ESTATÍSTICAS
-- ============================================================================

-- Verificar mensagens com problemas
SELECT 
    'Mensagens com status incorreto' as check_type,
    COUNT(*) as count
FROM messages 
WHERE billing_status != 'debited';

-- Verificar mensagens outbound com tokens incorretos
SELECT 
    'Mensagens outbound com tokens != 1' as check_type,
    COUNT(*) as count
FROM messages 
WHERE direction = 'outbound' AND tokens_used != 1;

-- Verificar mensagens inbound com tokens incorretos
SELECT 
    'Mensagens inbound com tokens != 0' as check_type,
    COUNT(*) as count
FROM messages 
WHERE direction = 'inbound' AND tokens_used != 0;

-- Estatísticas finais
SELECT 
    direction,
    billing_status,
    COUNT(*) as total_messages,
    AVG(tokens_used) as avg_tokens,
    SUM(cost_credits) as total_credits
FROM messages 
GROUP BY direction, billing_status
ORDER BY direction, billing_status;

-- 6. TESTE DO TRIGGER
-- ============================================================================

-- Inserir mensagem de teste outbound
INSERT INTO messages (
    id, user_id, chatbot_id, direction, content, 
    billing_status, tokens_used, cost_credits
) VALUES (
    gen_random_uuid(), 
    (SELECT id FROM users LIMIT 1),
    (SELECT id FROM chatbots LIMIT 1),
    'outbound', 
    'Teste do sistema simplificado',
    'charged', -- Será convertido para 'debited'
    999,       -- Será convertido para 1
    999        -- Será convertido para 1
) RETURNING id, billing_status, tokens_used, cost_credits, charged_at;

-- Inserir mensagem de teste inbound
INSERT INTO messages (
    id, user_id, chatbot_id, direction, content,
    billing_status, tokens_used, cost_credits
) VALUES (
    gen_random_uuid(),
    (SELECT id FROM users LIMIT 1),
    (SELECT id FROM chatbots LIMIT 1),
    'inbound',
    'Mensagem recebida de teste',
    'charged', -- Será convertido para 'debited'
    999,       -- Será convertido para 0
    999        -- Será convertido para 0
) RETURNING id, billing_status, tokens_used, cost_credits, charged_at;

COMMIT;

-- ============================================================================
-- RESUMO DO SISTEMA SIMPLIFICADO:
-- 
-- REGRA ÚNICA: Todas as mensagens têm billing_status = 'debited'
-- - Mensagens OUTBOUND: tokens_used = 1, cost_credits = 1
-- - Mensagens INBOUND: tokens_used = 0, cost_credits = 0
-- 
-- BENEFÍCIOS:
-- ✅ Elimina conversões complexas de status
-- ✅ Elimina perda de tokens
-- ✅ Sistema previsível e confiável
-- ✅ Fácil de entender e manter
-- ============================================================================