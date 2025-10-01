-- SCHEMA PARA SISTEMA DE NOTIFICAÇÕES EM TEMPO REAL
-- Suporte completo para alertas, preferências e auditoria

-- Tabela para preferências de notificação por organização
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id TEXT NOT NULL UNIQUE,
    low_balance_alerts BOOLEAN DEFAULT true,
    low_balance_threshold INTEGER DEFAULT 100,
    email_notifications BOOLEAN DEFAULT true,
    webhook_url TEXT,
    slack_webhook TEXT,
    discord_webhook TEXT,
    notification_frequency TEXT DEFAULT 'immediate' CHECK (notification_frequency IN ('immediate', 'hourly', 'daily')),
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para alertas de cobrança
CREATE TABLE IF NOT EXISTS billing_alerts (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('low_balance', 'insufficient_credits', 'reservation_failed', 'circuit_breaker', 'reconciliation_needed')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Tabela para histórico de notificações enviadas
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_id TEXT REFERENCES billing_alerts(id),
    org_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('websocket', 'email', 'webhook', 'slack', 'discord', 'sms')),
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending', 'delivered')),
    recipient TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Tabela para métricas de notificações
CREATE TABLE IF NOT EXISTS notification_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id TEXT NOT NULL,
    date DATE NOT NULL,
    channel TEXT NOT NULL,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    avg_delivery_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, date, channel)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_billing_alerts_org_id ON billing_alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_alerts_created_at ON billing_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_alerts_type_severity ON billing_alerts(type, severity);
CREATE INDEX IF NOT EXISTS idx_billing_alerts_acknowledged ON billing_alerts(acknowledged, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_alert_id ON notification_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_org_id ON notification_history(org_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_metrics_org_date ON notification_metrics(org_id, date DESC);

-- Função para limpeza automática de alertas antigos
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Remove alertas reconhecidos com mais de 30 dias
    DELETE FROM billing_alerts 
    WHERE acknowledged = true 
    AND acknowledged_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Remove alertas não reconhecidos com mais de 90 dias
    DELETE FROM billing_alerts 
    WHERE acknowledged = false 
    AND created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Remove histórico de notificações com mais de 6 meses
    DELETE FROM notification_history 
    WHERE sent_at < NOW() - INTERVAL '6 months';
    
    -- Limpar métricas antigas (manter apenas 1 ano)
    DELETE FROM notification_metrics 
    WHERE date < CURRENT_DATE - INTERVAL '1 year';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular métricas diárias
CREATE OR REPLACE FUNCTION calculate_daily_notification_metrics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
    -- Inserir ou atualizar métricas do dia
    INSERT INTO notification_metrics (org_id, date, channel, total_sent, total_delivered, total_failed, avg_delivery_time_ms)
    SELECT 
        nh.org_id,
        target_date,
        nh.channel,
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE nh.status = 'delivered') as total_delivered,
        COUNT(*) FILTER (WHERE nh.status = 'failed') as total_failed,
        AVG(EXTRACT(EPOCH FROM (nh.delivered_at - nh.sent_at)) * 1000)::INTEGER as avg_delivery_time_ms
    FROM notification_history nh
    WHERE DATE(nh.sent_at) = target_date
    GROUP BY nh.org_id, nh.channel
    ON CONFLICT (org_id, date, channel) 
    DO UPDATE SET
        total_sent = EXCLUDED.total_sent,
        total_delivered = EXCLUDED.total_delivered,
        total_failed = EXCLUDED.total_failed,
        avg_delivery_time_ms = EXCLUDED.avg_delivery_time_ms;
END;
$$ LANGUAGE plpgsql;

-- Função para obter estatísticas de alertas por organização
CREATE OR REPLACE FUNCTION get_alert_statistics(p_org_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_alerts INTEGER,
    critical_alerts INTEGER,
    warning_alerts INTEGER,
    info_alerts INTEGER,
    acknowledged_alerts INTEGER,
    avg_acknowledgment_time_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_alerts,
        COUNT(*) FILTER (WHERE severity = 'critical')::INTEGER as critical_alerts,
        COUNT(*) FILTER (WHERE severity = 'warning')::INTEGER as warning_alerts,
        COUNT(*) FILTER (WHERE severity = 'info')::INTEGER as info_alerts,
        COUNT(*) FILTER (WHERE acknowledged = true)::INTEGER as acknowledged_alerts,
        AVG(
            CASE 
                WHEN acknowledged = true AND acknowledged_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 3600
                ELSE NULL 
            END
        )::NUMERIC(10,2) as avg_acknowledgment_time_hours
    FROM billing_alerts
    WHERE org_id = p_org_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Função para obter alertas não reconhecidos por severidade
CREATE OR REPLACE FUNCTION get_unacknowledged_alerts_by_severity(p_org_id TEXT)
RETURNS TABLE (
    severity TEXT,
    count INTEGER,
    oldest_alert_age_hours INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ba.severity,
        COUNT(*)::INTEGER as count,
        MAX(EXTRACT(EPOCH FROM (NOW() - ba.created_at)) / 3600)::INTEGER as oldest_alert_age_hours
    FROM billing_alerts ba
    WHERE ba.org_id = p_org_id
    AND ba.acknowledged = false
    GROUP BY ba.severity
    ORDER BY 
        CASE ba.severity 
            WHEN 'critical' THEN 1
            WHEN 'warning' THEN 2
            WHEN 'info' THEN 3
        END;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para registrar histórico de notificações automaticamente
CREATE OR REPLACE FUNCTION log_notification_attempt()
RETURNS TRIGGER AS $$
BEGIN
    -- Este trigger pode ser usado para logging automático
    -- quando necessário
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- View para dashboard de alertas
CREATE OR REPLACE VIEW alert_dashboard AS
SELECT 
    ba.org_id,
    ba.severity,
    ba.type,
    COUNT(*) as alert_count,
    COUNT(*) FILTER (WHERE ba.acknowledged = false) as unacknowledged_count,
    MAX(ba.created_at) as latest_alert,
    MIN(ba.created_at) FILTER (WHERE ba.acknowledged = false) as oldest_unacknowledged
FROM billing_alerts ba
WHERE ba.created_at >= NOW() - INTERVAL '7 days'
GROP BY ba.org_id, ba.severity, ba.type;

-- View para métricas de performance de notificações
CREATE OR REPLACE VIEW notification_performance AS
SELECT 
    nm.org_id,
    nm.channel,
    AVG(nm.total_sent) as avg_daily_sent,
    AVG(nm.total_delivered::FLOAT / NULLIF(nm.total_sent, 0) * 100) as delivery_rate_percent,
    AVG(nm.avg_delivery_time_ms) as avg_delivery_time_ms,
    COUNT(*) as days_tracked
FROM notification_metrics nm
WHERE nm.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY nm.org_id, nm.channel;

-- Inserir configurações padrão para organizações existentes
INSERT INTO notification_preferences (org_id, low_balance_alerts, low_balance_threshold, email_notifications)
SELECT DISTINCT org_id, true, 100, true
FROM credit_wallets cw
WHERE NOT EXISTS (
    SELECT 1 FROM notification_preferences np 
    WHERE np.org_id = cw.org_id
)
ON CONFLICT (org_id) DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE notification_preferences IS 'Configurações de notificação personalizáveis por organização';
COMMENT ON TABLE billing_alerts IS 'Alertas gerados pelo sistema de cobrança';
COMMENT ON TABLE notification_history IS 'Histórico de todas as notificações enviadas';
COMMENT ON TABLE notification_metrics IS 'Métricas agregadas de performance das notificações';

COMMENT ON FUNCTION cleanup_old_alerts() IS 'Remove alertas antigos para manter a performance do sistema';
COMMENT ON FUNCTION calculate_daily_notification_metrics(DATE) IS 'Calcula métricas diárias de notificações';
COMMENT ON FUNCTION get_alert_statistics(TEXT, INTEGER) IS 'Retorna estatísticas de alertas para uma organização';