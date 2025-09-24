const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMessages() {
  console.log('🔍 Verificando mensagens no banco...\n');
  
  try {
    // Verificar últimas mensagens
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      return;
    }
    
    console.log(`📊 Total de mensagens encontradas: ${messages.length}\n`);
    
    if (messages.length === 0) {
      console.log('⚠️  Nenhuma mensagem encontrada no banco!');
      console.log('💡 Isso pode indicar que:');
      console.log('   - O webhook não está salvando mensagens');
      console.log('   - Não houve mensagens recebidas ainda');
      console.log('   - Há um problema na configuração do banco\n');
    } else {
      console.log('📋 Últimas mensagens:');
      messages.forEach((msg, i) => {
        const date = new Date(msg.created_at).toLocaleString('pt-BR');
        const content = msg.message_content ? msg.message_content.substring(0, 50) : 'N/A';
        console.log(`${i+1}. [${date}] ${msg.direction} - ${msg.phone_number}: ${content}...`);
      });
    }

    // Verificar dispositivos
    console.log('\n🔍 Verificando dispositivos...');
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (devicesError) {
      console.error('❌ Erro ao buscar dispositivos:', devicesError);
      return;
    }
    
    console.log(`📱 Total de dispositivos: ${devices.length}`);
    devices.forEach((device, i) => {
      console.log(`${i+1}. ${device.session_name} - Status: ${device.status} - Org: ${device.organization_id}`);
    });

    // Verificar chatbots
    console.log('\n🤖 Verificando chatbots...');
    const { data: chatbots, error: chatbotsError } = await supabase
      .from('chatbots')
      .select('*')
      .eq('is_active', true);
      
    if (chatbotsError) {
      console.error('❌ Erro ao buscar chatbots:', chatbotsError);
      return;
    }
    
    console.log(`🤖 Total de chatbots ativos: ${chatbots.length}`);
    chatbots.forEach((bot, i) => {
      console.log(`${i+1}. ${bot.name} - Org: ${bot.organization_id} - Device: ${bot.device_id || 'Genérico'}`);
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkMessages();