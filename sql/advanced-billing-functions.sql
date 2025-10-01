-- =====================================================
-- SISTEMA AVANÇADO DE COBRANÇA - FUNÇÕES SQL
-- =====================================================

-- Tabela para reservas de crédito
CREATE TABLE IF NOT EXISTS credit_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    reserved_amount DECIMAL(10,2) NOT NULL,
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired', 'cancelled')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para transações de cobrança
CREATE TABLE IF NOT EXISTS billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('debit', 'credit', 'reserve', 'release')),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
    reservation_id UUID REFERENCES credit_reservations(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Tabela para auditoria detalhada
CREATE TABLE IF NOT EXISTS billing_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    transaction_id UUID REFERENCES billing_transactions(id),
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_credit_reservations_org_status ON credit_reservations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_expiry ON credit_reservations(expiry_time) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_billing_transactions_org_status ON billing_transactions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_audit_org_created ON billing_audit_log(org_id, created_at);

-- =====================================================
-- FUNÇÃO: RESERVA ATÔMICA DE CRÉDITOS
-- =====================================================
CREATE OR REPLACE FUNCTION atomic_credit_reservation(
    p_org_id TEXT,
    p_amount DECIMAL(10,2),
    p_metadata JSONB DEFAULT '{}',
    p_expiry_minutes INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance DECIMAL(10,2);
    v_reserved_total DECIMAL(10,2);
    v_available_balance DECIMAL(10,2);
    v_reservation_id UUID;
    v_expiry_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Iniciar transação com lock exclusivo
    PERFORM pg_advisory_xact_lock(hashtext(p_org_id));
    
    -- Obter saldo atual
    SELECT balance INTO v_current_balance
    FROM credit_wallets
    WHERE org_id = p_org_id
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Carteira não encontrada'
        );
    END IF;
    
    -- Calcular total de reservas ativas
    SELECT COALESCE(SUM(reserved_amount), 0) INTO v_reserved_total
    FROM credit_reservations
    WHERE org_id = p_org_id 
    AND status = 'active' 
    AND expiry_time > NOW();
    
    -- Calcular saldo disponível
    v_available_balance := v_current_balance - v_reserved_total;
    
    -- Verificar se há saldo suficiente
    IF v_available_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Saldo insuficiente para reserva',
            'current_balance', v_current_balance,
            'reserved_amount', v_reserved_total,
            'available_balance', v_available_balance,
            'requested_amount', p_amount
        );
    END IF;
    
    -- Criar reserva
    v_expiry_time := NOW() + (p_expiry_minutes || ' minutes')::INTERVAL;
    
    INSERT INTO credit_reservations (
        org_id, reserved_amount, expiry_time, metadata
    ) VALUES (
        p_org_id, p_amount, v_expiry_time, p_metadata
    ) RETURNING id INTO v_reservation_id;
    
    -- Registrar transação de reserva
    INSERT INTO billing_transactions (
        org_id, type, amount, status, reservation_id, metadata
    ) VALUES (
        p_org_id, 'reserve', p_amount, 'completed', v_reservation_id, p_metadata
    );
    
    -- Log de auditoria
    INSERT INTO billing_audit_log (
        org_id, action, new_values
    ) VALUES (
        p_org_id, 'credit_reserved', 
        jsonb_build_object(
            'reservation_id', v_reservation_id,
            'amount', p_amount,
            'expiry_time', v_expiry_time
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'reserved_amount', p_amount,
        'expiry_time', v_expiry_time,
        'available_balance', v_available_balance - p_amount
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Erro interno: ' || SQLERRM
        );
END;
$$;

-- =====================================================
-- FUNÇÃO: COBRANÇA ATÔMICA COM ROLLBACK
-- =====================================================
CREATE OR REPLACE FUNCTION atomic_credit_charge(
    p_reservation_id UUID,
    p_actual_cost DECIMAL(10,2),
    p_usage_details JSONB,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation credit_reservations%ROWTYPE;
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
    v_transaction_id UUID;
    v_usage_event_id UUID;
BEGIN
    -- Iniciar transação com lock exclusivo
    PERFORM pg_advisory_xact_lock(hashtext(p_reservation_id::TEXT));
    
    -- Verificar reserva
    SELECT * INTO v_reservation
    FROM credit_reservations
    WHERE id = p_reservation_id
    AND status = 'active'
    AND expiry_time > NOW()
    FOR UPDATE;
    
    IF v_reservation.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Reserva não encontrada ou expirada'
        );
    END IF;
    
    -- Verificar se o custo real não excede a reserva
    IF p_actual_cost > v_reservation.reserved_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Custo real excede o valor reservado',
            'reserved_amount', v_reservation.reserved_amount,
            'actual_cost', p_actual_cost
        );
    END IF;
    
    -- Obter saldo atual com lock
    SELECT balance INTO v_current_balance
    FROM credit_wallets
    WHERE org_id = v_reservation.org_id
    FOR UPDATE;
    
    -- Calcular novo saldo
    v_new_balance := v_current_balance - p_actual_cost;
    
    -- Atualizar saldo da carteira
    UPDATE credit_wallets
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE org_id = v_reservation.org_id;
    
    -- Marcar reserva como consumida
    UPDATE credit_reservations
    SET status = 'consumed',
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- Criar transação de débito
    INSERT INTO billing_transactions (
        org_id, type, amount, status, reservation_id, metadata
    ) VALUES (
        v_reservation.org_id, 'debit', p_actual_cost, 'completed', p_reservation_id, p_metadata
    ) RETURNING id INTO v_transaction_id;
    
    -- Registrar evento de uso
    INSERT INTO usage_events (
        org_id, agent_id, message_id, credits_used, 
        input_tokens, output_tokens, metadata
    ) VALUES (
        v_reservation.org_id,
        (p_usage_details->>'agentId')::TEXT,
        (p_usage_details->>'messageId')::TEXT,
        p_actual_cost,
        (p_usage_details->>'inputTokens')::INTEGER,
        (p_usage_details->>'outputTokens')::INTEGER,
        p_usage_details
    ) RETURNING id INTO v_usage_event_id;
    
    -- Se sobrou crédito da reserva, liberar
    IF p_actual_cost < v_reservation.reserved_amount THEN
        INSERT INTO billing_transactions (
            org_id, type, amount, status, reservation_id, metadata
        ) VALUES (
            v_reservation.org_id, 'release', 
            v_reservation.reserved_amount - p_actual_cost, 
            'completed', p_reservation_id, 
            jsonb_build_object('reason', 'unused_reservation')
        );
    END IF;
    
    -- Log de auditoria
    INSERT INTO billing_audit_log (
        org_id, transaction_id, action, new_values
    ) VALUES (
        v_reservation.org_id, v_transaction_id, 'credit_charged',
        jsonb_build_object(
            'reservation_id', p_reservation_id,
            'actual_cost', p_actual_cost,
            'new_balance', v_new_balance,
            'usage_event_id', v_usage_event_id
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'usage_event_id', v_usage_event_id,
        'charged_amount', p_actual_cost,
        'new_balance', v_new_balance,
        'released_amount', v_reservation.reserved_amount - p_actual_cost
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback automático em caso de erro
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Erro na cobrança: ' || SQLERRM
        );
END;
$$;

-- =====================================================
-- FUNÇÃO: ROLLBACK DE RESERVA
-- =====================================================
CREATE OR REPLACE FUNCTION rollback_reservation(
    p_reservation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation credit_reservations%ROWTYPE;
BEGIN
    -- Obter reserva com lock
    SELECT * INTO v_reservation
    FROM credit_reservations
    WHERE id = p_reservation_id
    FOR UPDATE;
    
    IF v_reservation.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Reserva não encontrada'
        );
    END IF;
    
    -- Cancelar reserva
    UPDATE credit_reservations
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- Registrar transação de liberação
    INSERT INTO billing_transactions (
        org_id, type, amount, status, reservation_id, metadata
    ) VALUES (
        v_reservation.org_id, 'release', v_reservation.reserved_amount, 
        'completed', p_reservation_id, 
        jsonb_build_object('reason', 'rollback')
    );
    
    -- Log de auditoria
    INSERT INTO billing_audit_log (
        org_id, action, new_values
    ) VALUES (
        v_reservation.org_id, 'reservation_rolled_back',
        jsonb_build_object(
            'reservation_id', p_reservation_id,
            'amount', v_reservation.reserved_amount
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Reserva cancelada com sucesso'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Erro no rollback: ' || SQLERRM
        );
END;
$$;

-- =====================================================
-- FUNÇÃO: LIMPEZA DE RESERVAS EXPIRADAS
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired_count INTEGER;
BEGIN
    -- Marcar reservas expiradas
    UPDATE credit_reservations
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'active'
    AND expiry_time <= NOW();
    
    GET DIAGNOSTICS v_expired_count = ROW_COUNT;
    
    -- Registrar transações de liberação para reservas expiradas
    INSERT INTO billing_transactions (
        org_id, type, amount, status, reservation_id, metadata
    )
    SELECT 
        org_id, 'release', reserved_amount, 'completed', id,
        jsonb_build_object('reason', 'expiration')
    FROM credit_reservations
    WHERE status = 'expired'
    AND updated_at >= NOW() - INTERVAL '1 minute';
    
    RETURN jsonb_build_object(
        'success', true,
        'expired_reservations', v_expired_count
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Erro na limpeza: ' || SQLERRM
        );
END;
$$;

-- =====================================================
-- FUNÇÃO: RECONCILIAÇÃO DE TRANSAÇÕES
-- =====================================================
CREATE OR REPLACE FUNCTION reconcile_billing_transactions(
    p_org_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_balance DECIMAL(10,2);
    v_calculated_balance DECIMAL(10,2);
    v_discrepancies JSONB := '[]'::JSONB;
    v_corrections JSONB := '[]'::JSONB;
BEGIN
    -- Obter saldo atual da carteira
    SELECT balance INTO v_wallet_balance
    FROM credit_wallets
    WHERE org_id = p_org_id;
    
    -- Calcular saldo baseado nas transações
    WITH transaction_summary AS (
        SELECT 
            COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_credits,
            COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_debits
        FROM billing_transactions
        WHERE org_id = p_org_id
        AND status = 'completed'
    )
    SELECT (total_credits - total_debits) INTO v_calculated_balance
    FROM transaction_summary;
    
    -- Verificar discrepâncias
    IF ABS(v_wallet_balance - v_calculated_balance) > 0.01 THEN
        v_discrepancies := jsonb_build_array(
            jsonb_build_object(
                'type', 'balance_mismatch',
                'wallet_balance', v_wallet_balance,
                'calculated_balance', v_calculated_balance,
                'difference', v_wallet_balance - v_calculated_balance
            )
        );
        
        -- Aplicar correção automática
        UPDATE credit_wallets
        SET balance = v_calculated_balance,
            updated_at = NOW()
        WHERE org_id = p_org_id;
        
        v_corrections := jsonb_build_array(
            jsonb_build_object(
                'type', 'balance_correction',
                'old_balance', v_wallet_balance,
                'new_balance', v_calculated_balance
            )
        );
        
        -- Log da correção
        INSERT INTO billing_audit_log (
            org_id, action, old_values, new_values
        ) VALUES (
            p_org_id, 'balance_reconciled',
            jsonb_build_object('balance', v_wallet_balance),
            jsonb_build_object('balance', v_calculated_balance)
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'discrepancies', v_discrepancies,
        'corrections', v_corrections
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Erro na reconciliação: ' || SQLERRM
        );
END;
$$;

-- =====================================================
-- TRIGGERS PARA AUDITORIA AUTOMÁTICA
-- =====================================================

-- Trigger para auditoria de mudanças na carteira
CREATE OR REPLACE FUNCTION audit_wallet_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO billing_audit_log (
            org_id, action, old_values, new_values
        ) VALUES (
            NEW.org_id, 'wallet_updated',
            jsonb_build_object('balance', OLD.balance),
            jsonb_build_object('balance', NEW.balance)
        );
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_wallet_changes ON credit_wallets;
CREATE TRIGGER trigger_audit_wallet_changes
    AFTER UPDATE ON credit_wallets
    FOR EACH ROW
    EXECUTE FUNCTION audit_wallet_changes();

-- =====================================================
-- VIEWS PARA RELATÓRIOS
-- =====================================================

-- View para saldo disponível (considerando reservas)
CREATE OR REPLACE VIEW available_balance_view AS
SELECT 
    cw.org_id,
    cw.balance as wallet_balance,
    COALESCE(cr.reserved_total, 0) as reserved_amount,
    cw.balance - COALESCE(cr.reserved_total, 0) as available_balance
FROM credit_wallets cw
LEFT JOIN (
    SELECT 
        org_id,
        SUM(reserved_amount) as reserved_total
    FROM credit_reservations
    WHERE status = 'active'
    AND expiry_time > NOW()
    GROUP BY org_id
) cr ON cw.org_id = cr.org_id;

-- View para histórico de transações
CREATE OR REPLACE VIEW transaction_history_view AS
SELECT 
    bt.id,
    bt.org_id,
    bt.type,
    bt.amount,
    bt.status,
    bt.created_at,
    bt.completed_at,
    cr.reserved_amount,
    cr.expiry_time,
    ue.agent_id,
    ue.message_id,
    ue.input_tokens,
    ue.output_tokens
FROM billing_transactions bt
LEFT JOIN credit_reservations cr ON bt.reservation_id = cr.id
LEFT JOIN usage_events ue ON bt.metadata->>'usage_event_id' = ue.id::TEXT
ORDER BY bt.created_at DESC;