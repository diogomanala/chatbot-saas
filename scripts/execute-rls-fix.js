require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

console.log('🔧 Executando correção das políticas RLS...');
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configurada' : 'Não configurada');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRLSPolicies() {
  try {
    const sql = fs.readFileSync('scripts/fix-rls-policies.sql', 'utf8');
    
    console.log('📝 Executando SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Erro ao executar SQL:', error);
      return;
    }
    
    console.log('✅ Políticas RLS corrigidas com sucesso!');
    console.log('📊 Resultado:', data);
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

fixRLSPolicies();