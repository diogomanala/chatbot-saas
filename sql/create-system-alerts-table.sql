-- Tabela para armazenar alertas do sistema
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_system_alerts_correlation_id ON system_alerts(correlation_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_alert_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(resolved) WHERE resolved = FALSE;

-- Índice composto para consultas comuns
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity_created ON system_alerts(severity, created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_system_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_alerts_updated_at
  BEFORE UPDATE ON system_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_system_alerts_updated_at();

-- RLS (Row Level Security) - apenas para usuários autenticados
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura e escrita para service_role
CREATE POLICY "Allow service_role full access" ON system_alerts
  FOR ALL USING (auth.role() = 'service_role');

-- Política para permitir leitura para usuários autenticados (dashboard)
CREATE POLICY "Allow authenticated read" ON system_alerts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Comentários para documentação
COMMENT ON TABLE system_alerts IS 'Tabela para armazenar alertas do sistema de webhook e chatbot';
COMMENT ON COLUMN system_alerts.correlation_id IS 'ID de correlação para rastrear o contexto do alerta';
COMMENT ON COLUMN system_alerts.alert_type IS 'Tipo do alerta (ex: webhook_error, device_creation_failed)';
COMMENT ON COLUMN system_alerts.severity IS 'Severidade do alerta: critical, high, medium, low';
COMMENT ON COLUMN system_alerts.metadata IS 'Dados adicionais do alerta em formato JSON';
COMMENT ON COLUMN system_alerts.resolved IS 'Indica se o alerta foi resolvido';

-- View para alertas não resolvidos
CREATE OR REPLACE VIEW active_alerts AS
SELECT 
  id,
  correlation_id,
  alert_type,
  severity,
  title,
  description,
  metadata,
  created_at,
  updated_at,
  -- Calcular idade do alerta
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 AS age_hours
FROM system_alerts 
WHERE resolved = FALSE
ORDER BY 
  CASE severity 
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  created_at DESC;

-- View para estatísticas de alertas
CREATE OR REPLACE VIEW alert_stats AS
SELECT 
  alert_type,
  severity,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE resolved = FALSE) as active_count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h_count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7d_count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM system_alerts
GROUP BY alert_type, severity
ORDER BY 
  CASE severity 
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  total_count DESC;

-- Função para limpar alertas antigos baseado na configuração de retenção
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Limpar alertas críticos após 90 dias
  DELETE FROM system_alerts 
  WHERE severity = 'critical' 
    AND resolved = TRUE 
    AND created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Limpar alertas high após 30 dias
  DELETE FROM system_alerts 
  WHERE severity = 'high' 
    AND resolved = TRUE 
    AND created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  -- Limpar alertas medium após 14 dias
  DELETE FROM system_alerts 
  WHERE severity = 'medium' 
    AND resolved = TRUE 
    AND created_at < NOW() - INTERVAL '14 days';
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  -- Limpar alertas low após 7 dias
  DELETE FROM system_alerts 
  WHERE severity = 'low' 
    AND resolved = TRUE 
    AND created_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comentário na função
COMMENT ON FUNCTION cleanup_old_alerts() IS 'Remove alertas antigos baseado na política de retenção por severidade';