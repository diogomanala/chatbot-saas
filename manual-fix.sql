-- ============================================================================
-- CORREÇÃO: TRIGGER PARA DEBITAR SALDO DA CARTEIRA AUTOMATICAMENTE
-- Execute este SQL no SQL Editor do Supabase Dashboard
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

-- 2. REMOVER TRIGGER EXISTENTE (se houver)
DROP TRIGGER IF EXISTS trigger_debit_wallet_balance ON messages;

-- 3. CRIAR TRIGGER PARA DEBITAR APÓS INSERÇÃO DA MENSAGEM
CREATE TRIGGER trigger_debit_wallet_balance
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION debit_wallet_balance();

-- 4. VERIFICAR SE FOI CRIADO
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_debit_wallet_balance';