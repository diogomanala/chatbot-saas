const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getValidIds() {
  console.log('🔍 Buscando IDs válidos para teste...\n');

  try {
    // Buscar organizações
    console.log('📋 Organizações disponíveis:');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .limit(5);

    if (orgError) {
      console.error('❌ Erro ao buscar organizações:', orgError);
    } else {
      orgs.forEach(org => {
        console.log(`- ${org.id} (${org.name} - ${org.slug})`);
      });
    }

    console.log('\n📋 Chatbots disponíveis:');
    const { data: chatbots, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, name, org_id, is_active')
      .limit(5);

    if (chatbotError) {
      console.error('❌ Erro ao buscar chatbots:', chatbotError);
    } else {
      chatbots.forEach(chatbot => {
        console.log(`- ${chatbot.id} (${chatbot.name} - org: ${chatbot.org_id} - ativo: ${chatbot.is_active})`);
      });
    }

    console.log('\n📋 Devices disponíveis:');
    const { data: devices, error: deviceError } = await supabase
      .from('devices')
      .select('id, name, org_id, status')
      .limit(5);

    if (deviceError) {
      console.error('❌ Erro ao buscar devices:', deviceError);
    } else {
      devices.forEach(device => {
        console.log(`- ${device.id} (${device.name} - org: ${device.org_id} - status: ${device.status})`);
      });
    }

    // Encontrar uma combinação válida
    if (orgs && orgs.length > 0 && chatbots && chatbots.length > 0 && devices && devices.length > 0) {
      const validOrg = orgs[0];
      const validChatbot = chatbots.find(c => c.org_id === validOrg.id) || chatbots[0];
      const validDevice = devices.find(d => d.org_id === validOrg.id) || devices[0];

      console.log('\n✅ Combinação válida encontrada:');
      console.log(`Org ID: ${validOrg.id}`);
      console.log(`Chatbot ID: ${validChatbot.id}`);
      console.log(`Device ID: ${validDevice.id}`);

      // Testar inserção com IDs válidos
      console.log('\n🧪 Testando inserção com IDs válidos...');
      
      const { data: testData, error: testError } = await supabase
        .from('messages')
        .insert({
          org_id: validOrg.id,
          chatbot_id: validChatbot.id,
          device_id: validDevice.id,
          phone_number: '5511999999999',
          message_content: 'Teste com IDs válidos',
          direction: 'inbound'
        })
        .select();

      if (testError) {
        console.error('❌ Erro no teste com IDs válidos:', testError);
      } else {
        console.log('✅ Inserção inbound bem-sucedida:', testData[0]?.id);

        // Testar inserção outbound
        const { data: outboundData, error: outboundError } = await supabase
          .from('messages')
          .insert({
            org_id: validOrg.id,
            chatbot_id: validChatbot.id,
            device_id: validDevice.id,
            phone_number: '5511999999999',
            message_content: 'Resposta teste com IDs válidos',
            direction: 'outbound'
          })
          .select();

        if (outboundError) {
          console.error('❌ Erro na inserção outbound:', outboundError);
        } else {
          console.log('✅ Inserção outbound bem-sucedida:', outboundData[0]?.id);
        }
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

getValidIds();