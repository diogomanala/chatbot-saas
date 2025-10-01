require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  process.exit(1);
}

// Criar cliente Supabase com service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔧 Configuração:');
console.log('URL:', SUPABASE_URL);
console.log('Service Key:', SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...');

async function createAlertsTable() {
  try {
    console.log('\n🎯 Criando tabela de alertas com service role key...');
    
    // SQL para criar a tabela
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS system_alerts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMPTZ,
        resolved_by VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Índices
      CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(type);
      CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(resolved);
      CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at);
    `;
    
    console.log('⏳ Executando SQL para criar tabela...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (error) {
      console.log('❌ Erro ao executar RPC:', error.message);
      console.log('🔄 Tentando executar SQL diretamente...');
      
      // Tentar criar usando query direta
      const { error: directError } = await supabase
        .from('system_alerts')
        .select('*')
        .limit(1);
        
      if (directError && directError.code === '42P01') {
        console.log('📝 Tabela não existe, criando manualmente...');
        console.log('\n📋 SQL para executar manualmente no Supabase:');
        console.log('=' .repeat(50));
        console.log(createTableSQL);
        console.log('=' .repeat(50));
      }
    } else {
      console.log('✅ Tabela criada com sucesso!');
    }
    
    // Verificar se a tabela existe
    console.log('\n🔍 Verificando se a tabela existe...');
    const { data: tableData, error: tableError } = await supabase
      .from('system_alerts')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.log('❌ Erro ao verificar tabela:', tableError.message);
      console.log('🔍 Código do erro:', tableError.code);
      
      if (tableError.code === '42P01') {
        console.log('\n📝 A tabela system_alerts não existe.');
        console.log('💡 Execute o SQL acima manualmente no painel do Supabase.');
      }
    } else {
      console.log('✅ Tabela system_alerts existe e está acessível!');
      
      // Testar inserção
      console.log('\n🧪 Testando inserção de alerta...');
      const { data: insertData, error: insertError } = await supabase
        .from('system_alerts')
        .insert({
          type: 'test',
          severity: 'low',
          title: 'Teste de Alerta',
          message: 'Este é um alerta de teste para verificar o funcionamento da tabela.'
        })
        .select();
      
      if (insertError) {
        console.log('❌ Erro ao inserir alerta de teste:', insertError.message);
      } else {
        console.log('✅ Alerta de teste inserido com sucesso!');
        console.log('📝 Dados inseridos:', insertData);
        
        // Limpar o teste
        if (insertData && insertData[0]) {
          await supabase
            .from('system_alerts')
            .delete()
            .eq('id', insertData[0].id);
          console.log('🧹 Alerta de teste removido.');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

createAlertsTable();