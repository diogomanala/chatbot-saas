require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ [MIGRATION-ERROR] Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔧 [MIGRATION] Iniciando migração da estrutura do banco...');
  
  try {
    // 1. Adicionar coluna instance_id
    console.log('📝 [MIGRATION] Adicionando coluna instance_id...');
    const { error: instanceIdError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE devices ADD COLUMN IF NOT EXISTS instance_id TEXT;'
    });
    
    if (instanceIdError && !instanceIdError.message.includes('already exists')) {
      console.log('⚠️ [MIGRATION] Tentando adicionar instance_id via SQL direto...');
      // Tentar via query direta
      const { error: directError } = await supabase
        .from('devices')
        .select('instance_id')
        .limit(1);
      
      if (directError && directError.message.includes('does not exist')) {
        console.log('❌ [MIGRATION] Coluna instance_id não existe e não pode ser criada via código');
        console.log('📋 [MIGRATION] Execute manualmente no SQL Editor do Supabase:');
        console.log('   ALTER TABLE devices ADD COLUMN instance_id TEXT;');
        console.log('   ALTER TABLE devices ADD COLUMN phone_jid TEXT;');
        console.log('   ALTER TABLE devices ADD COLUMN config JSONB DEFAULT \'{}\';');
        console.log('   CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_instance_id ON devices(instance_id);');
        return;
      }
    }
    
    // 2. Adicionar coluna phone_jid
    console.log('📝 [MIGRATION] Adicionando coluna phone_jid...');
    const { error: phoneJidError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE devices ADD COLUMN IF NOT EXISTS phone_jid TEXT;'
    });
    
    // 3. Adicionar coluna config
    console.log('📝 [MIGRATION] Adicionando coluna config...');
    const { error: configError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE devices ADD COLUMN IF NOT EXISTS config JSONB DEFAULT \'{}\';'
    });
    
    // 4. Criar índice único para instance_id
    console.log('📝 [MIGRATION] Criando índice único para instance_id...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_instance_id ON devices(instance_id);'
    });
    
    // 5. Migrar session_name para instance_id
    console.log('📝 [MIGRATION] Migrando session_name para instance_id...');
    const { error: migrateError } = await supabase.rpc('exec_sql', {
      sql: 'UPDATE devices SET instance_id = session_name WHERE instance_id IS NULL AND session_name IS NOT NULL;'
    });
    
    console.log('✅ [MIGRATION] Migração concluída com sucesso!');
    
    // Verificar resultado
    console.log('🔍 [MIGRATION] Verificando estrutura após migração...');
    const { data: devices, error: checkError } = await supabase
      .from('devices')
      .select('id, name, instance_id, phone_jid, config')
      .limit(5);
    
    if (checkError) {
      console.error('❌ [MIGRATION] Erro ao verificar estrutura:', checkError);
    } else {
      console.log('✅ [MIGRATION] Estrutura verificada:', devices?.length || 0, 'devices encontrados');
      if (devices && devices.length > 0) {
        console.log('📋 [MIGRATION] Exemplo de device:', devices[0]);
      }
    }
    
  } catch (error) {
    console.error('❌ [MIGRATION] Erro durante migração:', error);
    process.exit(1);
  }
}

applyMigration();