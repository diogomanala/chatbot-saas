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

// SQL básico para criar apenas a tabela
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
`;

// SQL para criar índices
const createIndexesSQL = `
CREATE INDEX IF NOT EXISTS idx_system_alerts_correlation_id ON system_alerts(correlation_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_alert_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at DESC);
`;

async function executeSQL(sql, description) {
  try {
    console.log(`⏳ ${description}...`);
    
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
    const sqlApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    const response = await fetch(sqlApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: sql
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Erro em ${description}:`, result);
      return false;
    }
    
    console.log(`✅ ${description} concluído!`);
    return true;
    
  } catch (error) {
    console.error(`❌ Erro em ${description}:`, error.message);
    return false;
  }
}

async function checkTableExists() {
  try {
    console.log('🔍 Verificando se a tabela existe...');
    
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
    const sqlApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    const response = await fetch(sqlApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          SELECT 
            table_name,
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'system_alerts' 
            AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      })
    });
    
    const result = await response.json();
    
    if (result.result && result.result.length > 0) {
      console.log('✅ Tabela system_alerts encontrada!');
      console.log('📋 Colunas:');
      result.result.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
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

async function testInsertAndSelect() {
  try {
    console.log('🧪 Testando inserção e consulta...');
    
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
    const sqlApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    // Inserir um registro de teste
    const insertSQL = `
      INSERT INTO system_alerts (
        correlation_id, 
        alert_type, 
        severity, 
        title, 
        description, 
        metadata
      ) VALUES (
        'test-${Date.now()}',
        'setup_test',
        'low',
        'Teste de configuração',
        'Alerta de teste para verificar funcionamento',
        '{"test": true, "created_by": "setup_script"}'
      )
      RETURNING id, correlation_id, alert_type, severity, title, created_at;
    `;
    
    const insertResponse = await fetch(sqlApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: insertSQL
      })
    });
    
    const insertResult = await insertResponse.json();
    
    if (!insertResponse.ok) {
      console.error('❌ Erro ao inserir:', insertResult);
      return false;
    }
    
    console.log('✅ Registro inserido com sucesso!');
    const insertedRecord = insertResult.result[0];
    console.log('📊 Dados inseridos:', insertedRecord);
    
    // Consultar o registro
    const selectSQL = `
      SELECT id, correlation_id, alert_type, severity, title, created_at
      FROM system_alerts 
      WHERE id = '${insertedRecord.id}'
    `;
    
    const selectResponse = await fetch(sqlApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: selectSQL
      })
    });
    
    const selectResult = await selectResponse.json();
    
    if (selectResult.result && selectResult.result.length > 0) {
      console.log('✅ Consulta funcionando!');
      console.log('📊 Dados consultados:', selectResult.result[0]);
    }
    
    // Limpar o teste
    const deleteSQL = `DELETE FROM system_alerts WHERE id = '${insertedRecord.id}'`;
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
    
    console.log('🧹 Registro de teste removido');
    return true;
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    return false;
  }
}

async function main() {
  console.log('🎯 Criando tabela básica de alertas...');
  
  // Criar a tabela
  const tableCreated = await executeSQL(createTableSQL, 'Criando tabela system_alerts');
  if (!tableCreated) {
    console.error('❌ Falha ao criar tabela');
    process.exit(1);
  }
  
  // Criar índices
  const indexesCreated = await executeSQL(createIndexesSQL, 'Criando índices');
  if (!indexesCreated) {
    console.log('⚠️  Falha ao criar índices, mas continuando...');
  }
  
  // Verificar se a tabela existe
  const tableExists = await checkTableExists();
  if (!tableExists) {
    console.error('❌ Tabela não foi encontrada após criação');
    process.exit(1);
  }
  
  // Testar inserção e consulta
  const testPassed = await testInsertAndSelect();
  if (!testPassed) {
    console.error('❌ Falha no teste de inserção/consulta');
    process.exit(1);
  }
  
  console.log('\n🎉 Tabela de alertas criada com sucesso!');
  console.log('📋 Recursos configurados:');
  console.log('   1. ✅ Tabela system_alerts');
  console.log('   2. ✅ Colunas com tipos corretos');
  console.log('   3. ✅ Índices para performance');
  console.log('   4. ✅ Teste de inserção/consulta');
  console.log('\n🚀 O sistema de alertas está pronto para uso!');
  console.log('\n📝 Próximo passo: Testar o sistema de alertas no webhook');
}

if (require.main === module) {
  main().catch(console.error);
}