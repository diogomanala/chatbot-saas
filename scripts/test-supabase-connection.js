const { createClient } = require('@supabase/supabase-js');

// Usar as mesmas configurações do setup-complete-database.js
const SUPABASE_URL = 'https://anlemekgocrrllsogxix.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_PR3yVUXsopPYTE87R1L3eA_62IHitGT';

console.log('🔧 Testando conexão com Supabase...');
console.log('URL:', SUPABASE_URL);
console.log('Service Key:', SUPABASE_SERVICE_KEY.substring(0, 20) + '...');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    console.log('📝 Testando consulta simples...');
    const { data, error } = await supabase
      .from('system_alerts')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro na consulta:', error);
      return;
    }
    
    console.log('✅ Conexão funcionando!');
    console.log('📊 Dados encontrados:', data?.length || 0, 'registros');
    
    // Agora vamos tentar corrigir as políticas RLS
    console.log('\n🔧 Corrigindo políticas RLS...');
    
    const rlsSQL = `
-- Remover políticas existentes
DROP POLICY IF EXISTS "system_alerts_select_policy" ON system_alerts;
DROP POLICY IF EXISTS "system_alerts_insert_policy" ON system_alerts;
DROP POLICY IF EXISTS "system_alerts_update_policy" ON system_alerts;
DROP POLICY IF EXISTS "system_alerts_delete_policy" ON system_alerts;

-- Criar políticas permissivas
CREATE POLICY "system_alerts_select_policy" ON system_alerts FOR SELECT USING (true);
CREATE POLICY "system_alerts_insert_policy" ON system_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "system_alerts_update_policy" ON system_alerts FOR UPDATE USING (true);
CREATE POLICY "system_alerts_delete_policy" ON system_alerts FOR DELETE USING (true);

-- Verificar se RLS está habilitado
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
    `;
    
    const { data: rlsData, error: rlsError } = await supabase.rpc('exec_sql', { sql: rlsSQL });
    
    if (rlsError) {
      console.error('❌ Erro ao corrigir RLS:', rlsError);
      return;
    }
    
    console.log('✅ Políticas RLS corrigidas!');
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

testConnection();