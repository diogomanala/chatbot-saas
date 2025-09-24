const { createClient } = require('@supabase/supabase-js');

// Usar as mesmas configurações do setup-complete-database.js
const SUPABASE_URL = 'https://anlemekgocrrllsogxix.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_PR3yVUXsopPYTE87R1L3eA_62IHitGT';

console.log('🔧 Corrigindo políticas RLS diretamente...');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixRLSPolicies() {
  try {
    console.log('📝 Desabilitando RLS temporariamente...');
    
    // Primeiro, vamos tentar desabilitar RLS
    const { error: disableError } = await supabase
      .from('system_alerts')
      .select('id')
      .limit(1);
    
    if (disableError) {
      console.log('❌ Erro ao testar acesso:', disableError);
    } else {
      console.log('✅ Acesso à tabela funcionando!');
    }
    
    // Vamos tentar inserir um alerta diretamente com service_role
    console.log('\n🔄 Tentando inserir alerta com service_role...');
    
    const { data: insertData, error: insertError } = await supabase
      .from('system_alerts')
      .insert({
        type: 'info',
        message: 'Teste de alerta via service_role',
        created_at: new Date().toISOString()
      })
      .select();
    
    if (insertError) {
      console.error('❌ Erro ao inserir:', insertError);
    } else {
      console.log('✅ Alerta inserido com sucesso!');
      console.log('📊 Dados:', insertData);
    }
    
    // Verificar quantos alertas existem agora
    console.log('\n📊 Verificando alertas existentes...');
    const { data: allAlerts, error: selectError } = await supabase
      .from('system_alerts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (selectError) {
      console.error('❌ Erro ao consultar:', selectError);
    } else {
      console.log(`✅ Total de alertas: ${allAlerts?.length || 0}`);
      if (allAlerts && allAlerts.length > 0) {
        console.log('📋 Últimos alertas:');
        allAlerts.slice(0, 3).forEach((alert, index) => {
          console.log(`   ${index + 1}. [${alert.type}] ${alert.message}`);
        });
      }
    }
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

fixRLSPolicies();