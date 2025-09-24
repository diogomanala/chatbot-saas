require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMessagesSchema() {
  try {
    console.log('🔍 [VERIFICANDO SCHEMA DA TABELA MESSAGES]\n');
    
    // Verificar colunas da tabela messages
    const { data, error } = await supabase
      .rpc('get_table_columns', { table_name: 'messages' })
      .select();
    
    if (error) {
      console.log('❌ Erro ao buscar schema via RPC, tentando query direta...');
      
      // Tentar query direta
      const { data: columns, error: columnError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'messages')
        .eq('table_schema', 'public');
      
      if (columnError) {
        console.log('❌ Erro na query direta também:', columnError);
        
        // Última tentativa: buscar uma mensagem para ver a estrutura
        const { data: sampleMessage, error: sampleError } = await supabase
          .from('messages')
          .select('*')
          .limit(1)
          .single();
        
        if (sampleError) {
          console.log('❌ Erro ao buscar mensagem de exemplo:', sampleError);
          return;
        }
        
        console.log('📋 Estrutura baseada em mensagem de exemplo:');
        if (sampleMessage) {
          Object.keys(sampleMessage).forEach(key => {
            console.log(`   - ${key}: ${typeof sampleMessage[key]}`);
          });
        }
        
      } else {
        console.log('📋 Colunas da tabela messages:');
        columns.forEach(col => {
          console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
      }
    } else {
      console.log('📋 Schema via RPC:', data);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkMessagesSchema();