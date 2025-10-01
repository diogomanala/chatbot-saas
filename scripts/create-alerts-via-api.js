const fetch = require('node-fetch');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN;

console.log('🔧 Configuração:');
console.log('URL:', supabaseUrl);
console.log('Access Token:', supabaseAccessToken ? `${supabaseAccessToken.substring(0, 20)}...` : 'NÃO ENCONTRADA');

if (!supabaseUrl || !supabaseAccessToken) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

// SQL para criar a tabela
const createTableSQL = `
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

-- Índices básicos
CREATE INDEX IF NOT EXISTS idx_system_alerts_correlation_id ON system_alerts(correlation_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_alert_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(resolved) WHERE resolved = FALSE;

-- Políticas RLS
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service_role full access" ON system_alerts;
CREATE POLICY "Allow service_role full access" ON system_alerts
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow authenticated read" ON system_alerts;
CREATE POLICY "Allow authenticated read" ON system_alerts
  FOR SELECT USING (auth.role() = 'authenticated');
`;

async function createTableViaAPI() {
  try {
    console.log('🚀 Criando tabela via Supabase Management API...');
    
    // Extrair o project ref da URL
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
    console.log('📋 Project Ref:', projectRef);
    
    // URL da API de SQL do Supabase
    const sqlApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    const response = await fetch(sqlApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: createTableSQL
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro na API:', result);
      return false;
    }
    
    console.log('✅ Tabela criada com sucesso!');
    console.log('📊 Resultado:', result);
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao criar tabela:', error.message);
    return false;
  }
}

async function testTableExists() {
  try {
    console.log('🔍 Verificando se a tabela foi criada...');
    
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
    const sqlApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    const response = await fetch(sqlApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: "SELECT table_name FROM information_schema.tables WHERE table_name = 'system_alerts' AND table_schema = 'public';"
      })
    });
    
    const result = await response.json();
    
    if (result.result && result.result.length > 0) {
      console.log('✅ Tabela system_alerts existe!');
      return true;
    } else {
      console.log('❌ Tabela system_alerts não encontrada');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error.message);
    return false;
  }
}

async function insertTestAlert() {
  try {
    console.log('🧪 Inserindo alerta de teste...');
    
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
    const sqlApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    const testSQL = `
      INSERT INTO system_alerts (correlation_id, alert_type, severity, title, description, metadata)
      VALUES (
        'test-${Date.now()}',
        'setup_test',
        'low',
        'Teste de configuração',
        'Alerta de teste para verificar funcionamento do sistema',
        '{"test": true, "created_by": "setup_script"}'
      )
      RETURNING id, correlation_id, alert_type, severity, title, created_at;
    `;
    
    const response = await fetch(sqlApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: testSQL
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro ao inserir teste:', result);
      return false;
    }
    
    console.log('✅ Alerta de teste inserido!');
    console.log('📊 Dados:', result.result[0]);
    
    // Limpar o teste
    const deleteSQL = `DELETE FROM system_alerts WHERE correlation_id LIKE 'test-%';`;
    await fetch(sqlApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: deleteSQL
      })
    });
    
    console.log('🧹 Alerta de teste removido');
    return true;
    
  } catch (error) {
    console.error('❌ Erro no teste de inserção:', error.message);
    return false;
  }
}

async function main() {
  console.log('🎯 Iniciando configuração da tabela de alertas via API...');
  
  // Criar a tabela
  const tableCreated = await createTableViaAPI();
  if (!tableCreated) {
    console.error('❌ Falha ao criar tabela');
    process.exit(1);
  }
  
  // Verificar se foi criada
  const tableExists = await testTableExists();
  if (!tableExists) {
    console.error('❌ Tabela não foi encontrada após criação');
    process.exit(1);
  }
  
  // Testar inserção
  const testPassed = await insertTestAlert();
  if (!testPassed) {
    console.error('❌ Falha no teste de inserção');
    process.exit(1);
  }
  
  console.log('\n🎉 Sistema de alertas configurado com sucesso!');
  console.log('📋 Próximos passos:');
  console.log('   1. ✅ Tabela system_alerts criada');
  console.log('   2. ✅ Índices configurados');
  console.log('   3. ✅ Políticas RLS aplicadas');
  console.log('   4. ✅ Teste de inserção passou');
  console.log('\n🚀 O sistema de alertas está pronto para uso!');
}

if (require.main === module) {
  main().catch(console.error);
}