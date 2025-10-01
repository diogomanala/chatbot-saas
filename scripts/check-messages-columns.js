const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMessagesColumns() {
  try {
    console.log('🔍 Verificando estrutura da tabela messages...');
    
    // Fazer uma query simples para obter informações sobre as colunas
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro ao consultar tabela messages:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Colunas encontradas na tabela messages:');
      const columns = Object.keys(data[0]);
      columns.forEach(col => {
        console.log(`  - ${col}`);
      });
    } else {
      console.log('⚠️ Tabela messages está vazia, tentando obter estrutura via RPC...');
      
      // Tentar obter informações do schema
      const { data: schemaData, error: schemaError } = await supabase
        .rpc('get_table_columns', { table_name: 'messages' })
        .single();
        
      if (schemaError) {
        console.log('ℹ️ RPC não disponível, mas tabela existe');
      }
    }
    
  } catch (err) {
    console.error('❌ Erro geral:', err.message);
  }
}

checkMessagesColumns();