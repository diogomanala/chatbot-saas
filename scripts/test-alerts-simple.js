const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurar cliente Supabase com chave anon (para teste)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🚀 Testando conexão com Supabase...');
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Chave Anon:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configurada ✅' : 'Não configurada ❌');

async function testConnection() {
  try {
    // Tentar uma consulta simples
    const { data, error } = await supabase
      .from('system_alerts')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Erro ao conectar:', error.message);
      console.log('\n📋 Para resolver:');
      console.log('1. Execute o script SQL no Supabase SQL Editor:');
      console.log('   scripts/create-system-alerts-table.sql');
      console.log('2. Verifique se a SUPABASE_SERVICE_ROLE_KEY está completa no .env');
      return false;
    }
    
    console.log('✅ Conexão com Supabase funcionando!');
    return true;
  } catch (error) {
    console.log('❌ Erro de conexão:', error.message);
    return false;
  }
}

async function testAlertsTable() {
  try {
    const { data, error } = await supabase
      .from('system_alerts')
      .select('*')
      .limit(5);
    
    if (error) {
      console.log('❌ Erro ao acessar tabela system_alerts:', error.message);
      return false;
    }
    
    console.log(`✅ Tabela system_alerts acessível! Encontrados ${data.length} alertas.`);
    
    if (data.length > 0) {
      console.log('\n📋 Alertas encontrados:');
      data.forEach((alert, index) => {
        console.log(`  ${index + 1}. [${alert.severity.toUpperCase()}] ${alert.title}`);
        console.log(`     Status: ${alert.resolved ? 'Resolvido' : 'Ativo'}`);
      });
    }
    
    return true;
  } catch (error) {
    console.log('❌ Erro ao testar tabela:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(50));
  
  const connectionOk = await testConnection();
  if (!connectionOk) {
    return;
  }
  
  console.log('\n' + '='.repeat(50));
  
  const tableOk = await testAlertsTable();
  if (!tableOk) {
    return;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Testes básicos concluídos com sucesso!');
  console.log('\n📊 Próximos passos:');
  console.log('1. ✅ Conexão com Supabase funcionando');
  console.log('2. ✅ Tabela system_alerts acessível');
  console.log('3. 🔄 Sistema de alertas integrado no dashboard');
  console.log('4. 🔄 Alertas sendo criados automaticamente nos webhooks');
}

runTests().catch(error => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});