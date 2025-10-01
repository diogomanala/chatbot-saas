require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ [DISCOVER-ERROR] Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function discoverMessagesColumns() {
  console.log('🔍 [DISCOVER] Descobrindo estrutura da tabela messages...');
  
  try {
    // Tentar inserir com chatbot_id obrigatório
    const testPayload = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b'
    };
    
    console.log('📝 [DISCOVER] Tentando inserir com campos obrigatórios...');
    const { data, error } = await supabase
      .from('messages')
      .insert(testPayload)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [DISCOVER-ERROR] Erro ao inserir:', error);
      
      // Analisar erro para descobrir próximo campo obrigatório
      if (error.message.includes('null value in column')) {
        const match = error.message.match(/null value in column "([^"]+)"/);  
        if (match) {
          console.log('📋 [DISCOVER-REQUIRED] Próximo campo obrigatório:', match[1]);
          
          // Tentar com mais campos
          const extendedPayload = {
            ...testPayload,
            [match[1]]: match[1] === 'device_id' ? 'test-device' : 
                       match[1] === 'content' ? 'Teste de mensagem' :
                       match[1] === 'text' ? 'Teste de mensagem' :
                       match[1] === 'message' ? 'Teste de mensagem' :
                       match[1] === 'phone_number' ? '5522997603813' :
                       match[1] === 'sender' ? '5522997603813' :
                       match[1] === 'type' ? 'text' :
                       'test-value'
          };
          
          console.log('🔄 [DISCOVER] Tentando com campo adicional:', extendedPayload);
          const { data: extendedData, error: extendedError } = await supabase
            .from('messages')
            .insert(extendedPayload)
            .select()
            .single();
          
          if (extendedError) {
            console.error('❌ [DISCOVER-EXTENDED-ERROR]:', extendedError);
          } else {
            console.log('✅ [DISCOVER-SUCCESS] Inserção funcionou!');
            console.log('📋 [DISCOVER-COLUMNS] Colunas descobertas:', Object.keys(extendedData));
            console.log('📊 [DISCOVER-DATA] Dados inseridos:', extendedData);
            
            // Limpar registro de teste
            await supabase.from('messages').delete().eq('id', extendedData.id);
            console.log('🧹 [DISCOVER-CLEANUP] Registro de teste removido');
          }
        }
      }
    } else {
      console.log('✅ [DISCOVER-SUCCESS] Inserção funcionou com campos mínimos!');
      console.log('📋 [DISCOVER-COLUMNS] Colunas descobertas:', Object.keys(data));
      console.log('📊 [DISCOVER-DATA] Dados inseridos:', data);
      
      // Limpar registro de teste
      await supabase.from('messages').delete().eq('id', data.id);
      console.log('🧹 [DISCOVER-CLEANUP] Registro de teste removido');
    }
    
    // Tentar descobrir todas as colunas através de uma consulta vazia
    console.log('🔍 [DISCOVER-ALL] Tentando descobrir todas as colunas...');
    const { data: allData, error: allError } = await supabase
      .from('messages')
      .select('*')
      .limit(0);
    
    if (allError) {
      console.error('❌ [DISCOVER-ALL-ERROR]:', allError);
    } else {
      console.log('✅ [DISCOVER-ALL] Consulta vazia funcionou');
      // Mesmo que não retorne dados, podemos tentar inserir um registro completo
    }
    
  } catch (error) {
    console.error('❌ [DISCOVER] Erro geral:', error);
  }
}

discoverMessagesColumns();