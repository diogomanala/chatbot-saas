-- ============================================================================
-- CORREÇÃO: TRIGGER PARA DEBITAR SALDO DA CARTEIRA AUTOMATICAMENTE
-- ============================================================================
-- Problema: O trigger atual só define os valores da mensagem, mas não debita
-- o saldo da carteira. Por isso o saldo fica sempre o mesmo.
-- ============================================================================

-- 1. FUNÇÃO PARA DEBITAR SALDO DA CARTEIRA
CREATE OR REPLACE FUNCTION debit_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Só debita para mensagens outbound com cost_credits > 0
    IF NEW.direction = 'outbound' AND NEW.cost_credits > 0 THEN
        
        -- Debitar do saldo da carteira
        UPDATE credit_wallets 
        SET balance = balance - NEW.cost_credits,
            updated_at = NOW()
        WHERE org_id = NEW.org_id;
        
        -- Verificar se a atualização foi bem-sucedida
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Carteira não encontrada para org_id: %', NEW.org_id;
        END IF;
        
        -- Log para debug
        RAISE NOTICE 'Debitado % créditos da carteira para org_id: %', NEW.cost_credits, NEW.org_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CRIAR TRIGGER PARA DEBITAR APÓS INSERÇÃO DA MENSAGEM
DROP TRIGGER IF EXISTS trigger_debit_wallet_balance ON messages;
CREATE TRIGGER trigger_debit_wallet_balance
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION debit_wallet_balance();

-- 3. VERIFICAÇÃO DO SALDO ATUAL
SELECT 
    org_id,
    balance as saldo_atual,
    updated_at
FROM credit_wallets 
ORDER BY updated_at DESC;

-- 4. TESTE: Inserir uma mensagem de teste para verificar se o débito funciona
-- (Descomente as linhas abaixo para testar)

/*
-- Verificar saldo antes
SELECT balance FROM credit_wallets WHERE org_id = 'SEU_ORG_ID_AQUI';

-- Inserir mensagem de teste
INSERT INTO messages (
    org_id,
    direction,
    content,
    billing_status,
    tokens_used,
    cost_credits
) VALUES (
    'SEU_ORG_ID_AQUI',  -- Substitua pelo seu org_id
    'outbound',
    'Mensagem de teste para verificar débito automático',
    'debited',
    1,
    1
);

-- Verificar saldo depois
SELECT balance FROM credit_wallets WHERE org_id = 'SEU_ORG_ID_AQUI';
*/

-- 5. ESTATÍSTICAS PARA VERIFICAÇÃO
SELECT 
    'Mensagens outbound hoje' as tipo,
    COUNT(*) as quantidade,
    SUM(cost_credits) as total_creditos
FROM messages 
WHERE direction = 'outbound' 
  AND DATE(created_at) = CURRENT_DATE;

SELECT 
    'Saldo atual das carteiras' as tipo,
    org_id,
    balance
FROM credit_wallets
ORDER BY updated_at DESC;