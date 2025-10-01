require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ [PRECISE-ERROR] Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function preciseMessagesTest() {
  console.log('🎯 [PRECISE] Teste preciso da estrutura messages...');
  
  try {
    // Buscar device real
    const { data: devices } = await supabase
      .from('devices')
      .select('id')
      .limit(1);
    
    const deviceId = devices?.[0]?.id || '00000000-0000-0000-0000-000000000000';
    
    // Campos obrigatórios conhecidos: org_id, chatbot_id, device_id, phone_number
    const testPayload = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b',
      device_id: deviceId,
      phone_number: '5522997603813'
    };
    
    console.log('📝 [PRECISE] Tentando com campos obrigatórios conhecidos...');
    const { data, error } = await supabase
      .from('messages')
      .insert(testPayload)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [PRECISE-ERROR]:', error);
      
      // Se ainda há erro, tentar com content
      const withContent = {
        ...testPayload,
        content: 'Teste de mensagem'
      };
      
      console.log('🔄 [PRECISE] Tentando com content...');
      const { data: contentData, error: contentError } = await supabase
        .from('messages')
        .insert(withContent)
        .select()
        .single();
      
      if (contentError) {
        console.error('❌ [PRECISE-CONTENT-ERROR]:', contentError);
        
        // Tentar com external_id
        const withExternalId = {
          ...withContent,
          external_id: 'test-' + Date.now()
        };
        
        console.log('🔄 [PRECISE] Tentando com external_id...');
        const { data: externalData, error: externalError } = await supabase
          .from('messages')
          .insert(withExternalId)
          .select()
          .single();
        
        if (externalError) {
          console.error('❌ [PRECISE-EXTERNAL-ERROR]:', externalError);
        } else {
          console.log('✅ [PRECISE-SUCCESS] Inserção com external_id funcionou!');
          console.log('📋 [PRECISE-COLUMNS] Estrutura da tabela messages:');
          Object.keys(externalData).sort().forEach(key => {
            console.log(`   ${key}: ${typeof externalData[key]} = ${JSON.stringify(externalData[key])}`);
          });
          
          // Limpar
          await supabase.from('messages').delete().eq('id', externalData.id);
          console.log('🧹 [PRECISE-CLEANUP] Registro removido');
        }
      } else {
        console.log('✅ [PRECISE-SUCCESS] Inserção com content funcionou!');
        console.log('📋 [PRECISE-COLUMNS] Estrutura da tabela messages:');
        Object.keys(contentData).sort().forEach(key => {
          console.log(`   ${key}: ${typeof contentData[key]} = ${JSON.stringify(contentData[key])}`);
        });
        
        // Limpar
        await supabase.from('messages').delete().eq('id', contentData.id);
        console.log('🧹 [PRECISE-CLEANUP] Registro removido');
      }
    } else {
      console.log('✅ [PRECISE-SUCCESS] Inserção básica funcionou!');
      console.log('📋 [PRECISE-COLUMNS] Estrutura da tabela messages:');
      Object.keys(data).sort().forEach(key => {
        console.log(`   ${key}: ${typeof data[key]} = ${JSON.stringify(data[key])}`);
      });
      
      // Limpar
      await supabase.from('messages').delete().eq('id', data.id);
      console.log('🧹 [PRECISE-CLEANUP] Registro removido');
    }
    
  } catch (error) {
    console.error('❌ [PRECISE] Erro geral:', error);
  }
}

preciseMessagesTest();