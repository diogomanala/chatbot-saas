require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDeviceChatbot() {
  try {
    console.log('🔧 Corrigindo relação device-chatbot...');
    
    // Buscar o chatbot ativo "Teste Zap"
    const activeChatbotId = 'f99ae725-f996-483d-8813-cde922d8877a';
    const inactiveChatbotId = '761a8909-6674-440b-9811-7a232efb8a4b';
    
    console.log(`\n🎯 Atualizando devices para usar chatbot ativo: ${activeChatbotId}`);
    
    // Atualizar todos os devices que estão usando o chatbot inativo
    const { data: updatedDevices, error: updateError } = await supabase
      .from('devices')
      .update({ chatbot_id: activeChatbotId })
      .eq('chatbot_id', inactiveChatbotId)
      .select();
    
    if (updateError) {
      console.error('❌ Erro ao atualizar devices:', updateError);
      return;
    }
    
    console.log(`✅ ${updatedDevices.length} device(s) atualizado(s):`);
    updatedDevices.forEach(device => {
      console.log(`   - ${device.name} (ID: ${device.id})`);
      console.log(`     Instance ID: ${device.instance_id}`);
      console.log(`     Novo Chatbot ID: ${device.chatbot_id}`);
    });
    
    // Verificar se a correção funcionou
    console.log('\n🔍 Verificando correção...');
    const { data: devices } = await supabase
      .from('devices')
      .select('*');
    
    for (const device of devices) {
      const { data: chatbot } = await supabase
        .from('chatbots')
        .select('name, is_active')
        .eq('id', device.chatbot_id)
        .single();
      
      console.log(`Device ${device.name}:`);
      console.log(`  Chatbot: ${chatbot?.name || 'Não encontrado'}`);
      console.log(`  Ativo: ${chatbot?.is_active || false}`);
      console.log(`  Status: ${chatbot?.is_active ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

fixDeviceChatbot();