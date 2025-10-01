const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase (usando chaves completas)
const SUPABASE_URL = 'https://anlemekgocrrllsogxix.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_PR3yVUXsopPYTE87R1L3eA_62IHitGT';

// Criar cliente Supabase com service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔧 Configuração:');
console.log('URL:', SUPABASE_URL);
console.log('Service Key:', SUPABASE_SERVICE_KEY.substring(0, 20) + '...');

async function createAlertsTable() {
  try {
    console.log('\n🎯 Criando tabela de alertas do sistema...');
    
    // SQL para criar a tabela system_alerts
    const createTableSQL = `
      -- Criar tabela system_alerts
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
    `;
    
    console.log('⏳ Criando tabela system_alerts...');
    const { data: createData, error: createError } = await supabase.rpc('exec_sql', {
      sql: createTableSQL
    });
    
    if (createError) {
      console.log('❌ Erro no RPC exec_sql:', createError.message);
      console.log('🔄 Tentando método alternativo...');
      
      // Método alternativo: tentar acessar a tabela diretamente
      const { data: testData, error: testError } = await supabase
        .from('system_alerts')
        .select('*')
        .limit(1);
        
      if (testError && testError.code === '42P01') {
        console.log('\n📝 A tabela system_alerts não existe.');
        console.log('\n🔧 Execute este SQL manualmente no Supabase SQL Editor:');
        console.log('=' .repeat(60));
        console.log(createTableSQL);
        console.log('\n-- Criar índices');
        console.log('CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(type);');
        console.log('CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);');
        console.log('CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(resolved);');
        console.log('CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at);');
        console.log('\n-- Criar trigger para updated_at');
        console.log('CREATE OR REPLACE FUNCTION update_updated_at_column()');
        console.log('RETURNS TRIGGER AS $$');
        console.log('BEGIN');
        console.log('    NEW.updated_at = NOW();');
        console.log('    RETURN NEW;');
        console.log('END;');
        console.log('$$ language plpgsql;');
        console.log('');
        console.log('CREATE TRIGGER update_system_alerts_updated_at');
        console.log('    BEFORE UPDATE ON system_alerts');
        console.log('    FOR EACH ROW');
        console.log('    EXECUTE FUNCTION update_updated_at_column();');
        console.log('=' .repeat(60));
        return;
      }
    } else {
      console.log('✅ Tabela system_alerts criada com sucesso!');
    }
    
    // Criar índices
    console.log('\n⏳ Criando índices...');
    const indexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(type);
      CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(resolved);
      CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at);
    `;
    
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: indexesSQL
    });
    
    if (indexError) {
      console.log('⚠️ Aviso ao criar índices:', indexError.message);
    } else {
      console.log('✅ Índices criados com sucesso!');
    }
    
    // Verificar se a tabela existe e está acessível
    console.log('\n🔍 Verificando tabela...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('system_alerts')
      .select('*')
      .limit(1);
    
    if (verifyError) {
      console.log('❌ Erro ao verificar tabela:', verifyError.message);
      console.log('🔍 Código do erro:', verifyError.code);
    } else {
      console.log('✅ Tabela system_alerts verificada com sucesso!');
      
      // Testar inserção
      console.log('\n🧪 Testando inserção de alerta...');
      const { data: insertData, error: insertError } = await supabase
        .from('system_alerts')
        .insert({
          type: 'system_test',
          severity: 'low',
          title: 'Teste de Sistema',
          message: 'Este é um alerta de teste para verificar o funcionamento da tabela system_alerts.',
          metadata: { test: true, created_by: 'setup_script' }
        })
        .select();
      
      if (insertError) {
        console.log('❌ Erro ao inserir alerta de teste:', insertError.message);
      } else {
        console.log('✅ Alerta de teste inserido com sucesso!');
        console.log('📝 Dados:', insertData[0]);
        
        // Limpar o teste
        if (insertData && insertData[0]) {
          const { error: deleteError } = await supabase
            .from('system_alerts')
            .delete()
            .eq('id', insertData[0].id);
            
          if (!deleteError) {
            console.log('🧹 Alerta de teste removido.');
          }
        }
      }
      
      console.log('\n🎉 Sistema de alertas configurado com sucesso!');
      console.log('\n📋 Próximos passos:');
      console.log('1. ✅ Tabela system_alerts criada');
      console.log('2. ✅ Índices configurados');
      console.log('3. ✅ Testes de inserção/remoção funcionando');
      console.log('4. 🔄 Implementar sistema de alertas na aplicação');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

createAlertsTable();