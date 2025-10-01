require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ [FINAL-ERROR] Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function finalMessagesDiscovery() {
  console.log('🔍 [FINAL] Descoberta final da estrutura messages...');
  
  try {
    // 1. Buscar um device real
    console.log('📋 [FINAL] Buscando device real...');
    const { data: devices, error: deviceError } = await supabase
      .from('devices')
      .select('id, name')
      .limit(1);
    
    let deviceId;
    if (deviceError || !devices || devices.length === 0) {
      console.log('⚠️ [FINAL] Nenhum device encontrado, usando UUID fictício');
      deviceId = '00000000-0000-0000-0000-000000000000';
    } else {
      deviceId = devices[0].id;
      console.log('✅ [FINAL] Device encontrado:', devices[0].name, deviceId);
    }
    
    // 2. Tentar inserir com campos obrigatórios conhecidos
    const testPayload = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b',
      device_id: deviceId
    };
    
    console.log('📝 [FINAL] Tentando inserir com UUID válido...');
    const { data, error } = await supabase
      .from('messages')
      .insert(testPayload)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [FINAL-ERROR] Ainda há erro:', error);
      
      // Tentar com mais campos comuns
      const extendedPayload = {
        ...testPayload,
        content: 'Teste de mensagem',
        sender: '5522997603813',
        type: 'text',
        direction: 'inbound'
      };
      
      console.log('🔄 [FINAL] Tentando com mais campos:', extendedPayload);
      const { data: extendedData, error: extendedError } = await supabase
        .from('messages')
        .insert(extendedPayload)
        .select()
        .single();
      
      if (extendedError) {
        console.error('❌ [FINAL-EXTENDED-ERROR]:', extendedError);
        
        // Última tentativa com todos os campos possíveis
        const fullPayload = {
          org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
          chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b',
          device_id: deviceId,
          content: 'Teste de mensagem',
          sender: '5522997603813',
          type: 'text',
          direction: 'inbound',
          phone_number: '5522997603813',
          message: 'Teste de mensagem',
          text: 'Teste de mensagem',
          message_text: 'Teste de mensagem',
          external_id: 'test-' + Date.now(),
          status: 'received',
          tokens_used: 0,
          metadata: {}
        };
        
        console.log('🎯 [FINAL] Última tentativa com todos os campos...');
        const { data: fullData, error: fullError } = await supabase
          .from('messages')
          .insert(fullPayload)
          .select()
          .single();
        
        if (fullError) {
          console.error('❌ [FINAL-FULL-ERROR]:', fullError);
        } else {
          console.log('✅ [FINAL-SUCCESS] Inserção completa funcionou!');
          console.log('📋 [FINAL-COLUMNS] Colunas da tabela messages:');
          Object.keys(fullData).forEach(key => {
            console.log(`   - ${key}: ${typeof fullData[key]} = ${fullData[key]}`);
          });
          
          // Limpar registro de teste
          await supabase.from('messages').delete().eq('id', fullData.id);
          console.log('🧹 [FINAL-CLEANUP] Registro de teste removido');
        }
      } else {
        console.log('✅ [FINAL-SUCCESS] Inserção estendida funcionou!');
        console.log('📋 [FINAL-COLUMNS] Colunas descobertas:', Object.keys(extendedData));
        
        // Limpar registro de teste
        await supabase.from('messages').delete().eq('id', extendedData.id);
        console.log('🧹 [FINAL-CLEANUP] Registro de teste removido');
      }
    } else {
      console.log('✅ [FINAL-SUCCESS] Inserção básica funcionou!');
      console.log('📋 [FINAL-COLUMNS] Colunas descobertas:', Object.keys(data));
      
      // Limpar registro de teste
      await supabase.from('messages').delete().eq('id', data.id);
      console.log('🧹 [FINAL-CLEANUP] Registro de teste removido');
    }
    
  } catch (error) {
    console.error('❌ [FINAL] Erro geral:', error);
  }
}

finalMessagesDiscovery();