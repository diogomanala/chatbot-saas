const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase usando as variáveis do .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Configuração:');
console.log('URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : 'NÃO ENCONTRADA');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  console.error('SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAlertsTable() {
  try {
    console.log('🚀 Criando tabela system_alerts...');
    
    // SQL simplificado para criar apenas a tabela básica
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
    
    // Tentar criar a tabela usando uma query direta
    const { data, error } = await supabase
      .from('system_alerts')
      .select('count')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.log('📋 Tabela não existe, tentando criar...');
      
      // A tabela não existe, vamos tentar criar usando o SQL Editor do Supabase
      console.log('⚠️  Para criar a tabela, execute o seguinte SQL no Supabase SQL Editor:');
      console.log('\n' + '='.repeat(80));
      console.log(createTableSQL);
      console.log('='.repeat(80));
      
      // Tentar uma abordagem alternativa - criar via insert que falha mas pode dar mais informações
      try {
        await supabase
          .from('system_alerts')
          .insert({
            correlation_id: 'test',
            alert_type: 'test',
            severity: 'low',
            title: 'test'
          });
      } catch (insertError) {
        console.log('ℹ️  Erro esperado ao tentar inserir (tabela não existe):', insertError.message);
      }
      
      return false;
    } else if (error) {
      console.error('❌ Erro ao verificar tabela:', error.message);
      return false;
    } else {
      console.log('✅ Tabela system_alerts já existe!');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    return false;
  }
}

async function testConnection() {
  try {
    console.log('🔍 Testando conexão com Supabase...');
    
    // Testar uma query simples
    const { data, error } = await supabase
      .from('devices')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro na conexão:', error.message);
      return false;
    }
    
    console.log('✅ Conexão com Supabase funcionando!');
    return true;
    
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
    return false;
  }
}

async function main() {
  console.log('🎯 Iniciando configuração simplificada do sistema de alertas...');
  
  // Testar conexão primeiro
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.error('❌ Falha na conexão com Supabase');
    process.exit(1);
  }
  
  // Tentar criar a tabela
  const tableCreated = await createAlertsTable();
  
  if (tableCreated) {
    console.log('\n🎉 Sistema de alertas configurado com sucesso!');
    
    // Testar inserção de um alerta
    try {
      const testAlert = {
        correlation_id: `test-${Date.now()}`,
        alert_type: 'setup_test',
        severity: 'low',
        title: 'Teste de configuração',
        description: 'Alerta de teste para verificar funcionamento'
      };
      
      const { data, error } = await supabase
        .from('system_alerts')
        .insert(testAlert)
        .select();
      
      if (error) {
        console.error('❌ Erro ao inserir alerta de teste:', error.message);
      } else {
        console.log('✅ Alerta de teste inserido com sucesso!');
        
        // Limpar o teste
        await supabase
          .from('system_alerts')
          .delete()
          .eq('id', data[0].id);
        
        console.log('🧹 Alerta de teste removido');
      }
    } catch (testError) {
      console.error('⚠️  Erro no teste:', testError.message);
    }
  } else {
    console.log('\n⚠️  Tabela não foi criada automaticamente.');
    console.log('📋 Execute o SQL mostrado acima no Supabase SQL Editor.');
    console.log('🔗 Acesse: https://supabase.com/dashboard/project/anlemekgocrrllsogxix/sql');
  }
}

if (require.main === module) {
  main().catch(console.error);
}