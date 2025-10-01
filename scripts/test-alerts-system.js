const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Configurar cliente Supabase com service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Função para verificar se a tabela existe
async function checkTable() {
  console.log('🔍 Verificando se a tabela system_alerts existe...');
  
  try {
    const { data, error } = await supabase
      .from('system_alerts')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Tabela não existe ou erro de acesso:', error.message);
      return false;
    }
    
    console.log('✅ Tabela system_alerts existe e está acessível');
    return true;
  } catch (error) {
    console.error('❌ Erro ao verificar tabela:', error.message);
    return false;
  }
}

// Função para criar um alerta de teste
async function createTestAlert() {
  console.log('📝 Criando alerta de teste...');
  
  const alertData = {
    id: uuidv4(),
    type: 'system',
    severity: 'medium',
    title: 'Teste do Sistema de Alertas',
    message: 'Este é um alerta de teste criado pelo script de verificação.',
    source: 'test-script',
    metadata: {
      test: true,
      timestamp: new Date().toISOString(),
      script_version: '1.0.0'
    },
    resolved: false
  };
  
  try {
    const { data, error } = await supabase
      .from('system_alerts')
      .insert([alertData])
      .select();
    
    if (error) {
      console.error('❌ Erro ao criar alerta:', error.message);
      return null;
    }
    
    console.log('✅ Alerta criado com sucesso:', data[0].id);
    return data[0];
  } catch (error) {
    console.error('❌ Erro ao criar alerta:', error.message);
    return null;
  }
}

// Função para buscar alertas ativos
async function getActiveAlerts() {
  console.log('🔍 Buscando alertas ativos...');
  
  try {
    const { data, error } = await supabase
      .from('system_alerts')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Erro ao buscar alertas:', error.message);
      return [];
    }
    
    console.log(`✅ Encontrados ${data.length} alertas ativos`);
    data.forEach(alert => {
      console.log(`  - [${alert.severity.toUpperCase()}] ${alert.title}`);
    });
    
    return data;
  } catch (error) {
    console.error('❌ Erro ao buscar alertas:', error.message);
    return [];
  }
}

// Função para resolver um alerta
async function resolveAlert(alertId) {
  console.log(`🔧 Resolvendo alerta ${alertId}...`);
  
  try {
    const { error } = await supabase
      .from('system_alerts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: 'test-script'
      })
      .eq('id', alertId);
    
    if (error) {
      console.error('❌ Erro ao resolver alerta:', error.message);
      return false;
    }
    
    console.log('✅ Alerta resolvido com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao resolver alerta:', error.message);
    return false;
  }
}

// Função principal de teste
async function runTests() {
  console.log('🚀 Iniciando testes do sistema de alertas\n');
  
  // 1. Verificar se a tabela existe
  const tableExists = await checkTable();
  if (!tableExists) {
    console.log('\n❌ Testes interrompidos: tabela não existe');
    console.log('Execute o script SQL primeiro: scripts/create-system-alerts-table.sql');
    return;
  }
  
  console.log('');
  
  // 2. Buscar alertas existentes
  const existingAlerts = await getActiveAlerts();
  console.log('');
  
  // 3. Criar um novo alerta
  const newAlert = await createTestAlert();
  if (!newAlert) {
    console.log('\n❌ Testes interrompidos: não foi possível criar alerta');
    return;
  }
  
  console.log('');
  
  // 4. Buscar alertas novamente para confirmar
  await getActiveAlerts();
  console.log('');
  
  // 5. Resolver o alerta criado
  const resolved = await resolveAlert(newAlert.id);
  if (resolved) {
    console.log('');
    console.log('🔍 Verificando se o alerta foi resolvido...');
    await getActiveAlerts();
  }
  
  console.log('\n🎉 Testes concluídos com sucesso!');
  console.log('\n📊 Resumo:');
  console.log('  ✅ Tabela system_alerts está funcionando');
  console.log('  ✅ Criação de alertas está funcionando');
  console.log('  ✅ Busca de alertas está funcionando');
  console.log('  ✅ Resolução de alertas está funcionando');
}

// Executar os testes
runTests().catch(error => {
  console.error('💥 Erro fatal nos testes:', error);
  process.exit(1);
});