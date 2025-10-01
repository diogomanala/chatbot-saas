require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMessagesRequired() {
  try {
    console.log('🔍 Verificando campos obrigatórios da tabela messages...');
    
    // Buscar uma mensagem existente para ver a estrutura
    const { data: existingMessage, error: existingError } = await supabase
      .from('messages')
      .select('*')
      .limit(1)
      .single();

    if (existingError) {
      console.log('⚠️ Nenhuma mensagem existente encontrada');
    } else {
      console.log('📋 Estrutura de mensagem existente:');
      Object.keys(existingMessage).sort().forEach(field => {
        const value = existingMessage[field];
        console.log(`   ${field}: ${value !== null ? typeof value : 'NULL'} = ${JSON.stringify(value)}`);
      });
    }

    // Tentar inserir com campos mínimos para descobrir obrigatórios
    console.log('\n🧪 Testando inserção com campos mínimos...');
    
    const testPayload = {
      org_id: 'b985ced2-5605-42b9-bd8e-b2c72cd6164f',
      chatbot_id: '7c8a2e0a-2f8c-4949-8b5c-c81ecf651b08'
    };

    const { data, error } = await supabase
      .from('messages')
      .insert(testPayload)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro na inserção:', error);
      
      // Analisar erro para descobrir campo obrigatório
      if (error.message.includes('null value in column')) {
        const match = error.message.match(/null value in column "([^"]+)"/);
        if (match) {
          console.log(`📋 Campo obrigatório encontrado: ${match[1]}`);
          
          // Tentar novamente com o campo obrigatório
          const extendedPayload = {
            ...testPayload,
            [match[1]]: match[1] === 'device_id' ? '00000000-0000-0000-0000-000000000000' :
                       match[1] === 'direction' ? 'inbound' :
                       match[1] === 'sender_phone' ? '5511999999999' :
                       match[1] === 'receiver_phone' ? 'bot' :
                       match[1] === 'content' ? 'Teste' :
                       match[1] === 'message_content' ? 'Teste' :
                       match[1] === 'phone_number' ? '5511999999999' :
                       'valor_teste'
          };
          
          console.log(`🔄 Tentando novamente com ${match[1]}...`);
          const { data: data2, error: error2 } = await supabase
            .from('messages')
            .insert(extendedPayload)
            .select()
            .single();
            
          if (error2) {
            console.error('❌ Ainda com erro:', error2);
          } else {
            console.log('✅ Sucesso! Estrutura mínima:');
            Object.keys(extendedPayload).forEach(key => {
              console.log(`   ${key}: ${extendedPayload[key]}`);
            });
            
            // Limpar
            await supabase.from('messages').delete().eq('id', data2.id);
          }
        }
      }
    } else {
      console.log('✅ Inserção funcionou com campos mínimos!');
      console.log('📋 Payload que funcionou:', testPayload);
      
      // Limpar
      await supabase.from('messages').delete().eq('id', data.id);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkMessagesRequired();