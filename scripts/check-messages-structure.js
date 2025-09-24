require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ [CHECK-ERROR] Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMessagesStructure() {
  console.log('🔍 [MESSAGES-CHECK] Verificando estrutura da tabela messages...');
  
  try {
    // Tentar inserir um registro de teste para descobrir a estrutura
    const testPayload = {
      id: 'test-' + Date.now(),
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      device_id: 'test-device',
      phone_number: '5522997603813',
      message_text: 'Teste',
      message_type: 'text',
      status: 'received'
    };
    
    console.log('📝 [MESSAGES-TEST] Tentando inserir registro de teste...');
    const { data, error } = await supabase
      .from('messages')
      .insert(testPayload)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [MESSAGES-ERROR] Erro ao inserir:', error);
      
      // Tentar descobrir estrutura através de select
      console.log('🔍 [MESSAGES-DISCOVER] Tentando descobrir estrutura...');
      const { data: emptyData, error: selectError } = await supabase
        .from('messages')
        .select('*')
        .limit(1);
      
      if (selectError) {
        console.error('❌ [MESSAGES-SELECT-ERROR]:', selectError);
      } else {
        console.log('✅ [MESSAGES-SELECT] Select funcionou, tabela existe');
      }
      
      // Tentar com campos mínimos
      console.log('🔍 [MESSAGES-MINIMAL] Tentando com campos mínimos...');
      const minimalPayload = {
        org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa'
      };
      
      const { data: minimalData, error: minimalError } = await supabase
        .from('messages')
        .insert(minimalPayload)
        .select()
        .single();
      
      if (minimalError) {
        console.error('❌ [MESSAGES-MINIMAL-ERROR]:', minimalError);
        
        // Analisar o erro para descobrir campos obrigatórios
        if (minimalError.message.includes('null value in column')) {
          const match = minimalError.message.match(/null value in column "([^"]+)"/);  
          if (match) {
            console.log('📋 [MESSAGES-REQUIRED] Campo obrigatório encontrado:', match[1]);
          }
        }
      } else {
        console.log('✅ [MESSAGES-MINIMAL] Inserção mínima funcionou:', minimalData);
        
        // Limpar registro de teste
        await supabase.from('messages').delete().eq('id', minimalData.id);
      }
      
    } else {
      console.log('✅ [MESSAGES-SUCCESS] Inserção de teste funcionou:', data);
      
      // Limpar registro de teste
      await supabase.from('messages').delete().eq('id', data.id);
      console.log('🧹 [MESSAGES-CLEANUP] Registro de teste removido');
    }
    
    // Tentar descobrir schema através de RPC
    console.log('🔍 [MESSAGES-SCHEMA] Tentando descobrir schema...');
    const { data: schemaData, error: schemaError } = await supabase.rpc('exec_sql', {
      sql: `SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            ORDER BY ordinal_position;`
    });
    
    if (schemaError) {
      console.log('⚠️ [MESSAGES-SCHEMA] Não foi possível obter schema via RPC');
    } else {
      console.log('✅ [MESSAGES-SCHEMA] Schema obtido:', schemaData);
    }
    
  } catch (error) {
    console.error('❌ [MESSAGES-CHECK] Erro geral:', error);
  }
}

checkMessagesStructure();