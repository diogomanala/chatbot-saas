-- Criar tabela para logs do super admin
CREATE TABLE IF NOT EXISTS super_admin_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  target_client_id UUID,
  target_client_email VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_super_admin_logs_admin_id ON super_admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_super_admin_logs_action ON super_admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_super_admin_logs_created_at ON super_admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_super_admin_logs_target_client ON super_admin_logs(target_client_id);

-- Habilitar RLS
ALTER TABLE super_admin_logs ENABLE ROW LEVEL SECURITY;

-- Política para super admins poderem ver todos os logs
CREATE POLICY "Super admins can view all logs" ON super_admin_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Política para super admins poderem inserir logs
CREATE POLICY "Super admins can insert logs" ON super_admin_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Comentários para documentação
COMMENT ON TABLE super_admin_logs IS 'Tabela para registrar todas as ações realizadas pelos super administradores';
COMMENT ON COLUMN super_admin_logs.admin_id IS 'ID do super admin que realizou a ação';
COMMENT ON COLUMN super_admin_logs.action IS 'Tipo de ação realizada (create_client, toggle_status, etc.)';
COMMENT ON COLUMN super_admin_logs.target_client_id IS 'ID do cliente afetado pela ação (se aplicável)';
COMMENT ON COLUMN super_admin_logs.target_client_email IS 'Email do cliente afetado (para facilitar consultas)';
COMMENT ON COLUMN super_admin_logs.details IS 'Detalhes adicionais da ação em formato JSON';
COMMENT ON COLUMN super_admin_logs.ip_address IS 'Endereço IP de onde a ação foi realizada';
COMMENT ON COLUMN super_admin_logs.user_agent IS 'User agent do navegador usado';