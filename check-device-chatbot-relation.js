require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDeviceChatbotRelation() {
  try {
    console.log('🔍 Verificando relação entre devices e chatbots...');
    
    // Buscar todos os devices
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (devicesError) {
      console.error('❌ Erro ao buscar devices:', devicesError);
      return;
    }
    
    console.log(`\n📱 Total de devices: ${devices.length}\n`);
    
    for (const device of devices) {
      console.log(`Device: ${device.name}`);
      console.log(`  ID: ${device.id}`);
      console.log(`  Instance ID: ${device.instance_id}`);
      console.log(`  Session Name: ${device.session_name}`);
      console.log(`  Org ID: ${device.org_id}`);
      console.log(`  Chatbot ID: ${device.chatbot_id}`);
      
      // Buscar chatbot ativo para esta organização
      const { data: activeChatbot, error: chatbotError } = await supabase
        .from('chatbots')
        .select('*')
        .eq('org_id', device.org_id)
        .eq('is_active', true)
        .single();
      
      if (chatbotError) {
        console.log(`  ❌ PROBLEMA: Nenhum chatbot ativo encontrado para org_id ${device.org_id}`);
        console.log(`     Erro: ${chatbotError.message}`);
        
        // Verificar se existe algum chatbot para esta org (mesmo inativo)
        const { data: anyChatbot } = await supabase
          .from('chatbots')
          .select('*')
          .eq('org_id', device.org_id);
        
        if (anyChatbot && anyChatbot.length > 0) {
          console.log(`     Chatbots encontrados (inativos): ${anyChatbot.length}`);
          anyChatbot.forEach(cb => {
            console.log(`       - ${cb.name} (Ativo: ${cb.is_active}, Default: ${cb.is_default})`);
          });
        } else {
          console.log(`     Nenhum chatbot encontrado para esta organização`);
        }
      } else {
        console.log(`  ✅ Chatbot ativo encontrado: ${activeChatbot.name} (ID: ${activeChatbot.id})`);
      }
      
      console.log('---');
    }
    
    // Verificar se há organizações sem chatbots ativos
    console.log('\n🔍 Resumo de problemas:');
    const orgIds = [...new Set(devices.map(d => d.org_id))];
    
    for (const orgId of orgIds) {
      const { data: activeChatbots } = await supabase
        .from('chatbots')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true);
      
      const devicesInOrg = devices.filter(d => d.org_id === orgId);
      
      if (!activeChatbots || activeChatbots.length === 0) {
        console.log(`❌ Org ${orgId}: ${devicesInOrg.length} device(s), 0 chatbot(s) ativo(s)`);
        devicesInOrg.forEach(d => {
          console.log(`   - Device: ${d.name} (${d.instance_id})`);
        });
      } else {
        console.log(`✅ Org ${orgId}: ${devicesInOrg.length} device(s), ${activeChatbots.length} chatbot(s) ativo(s)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkDeviceChatbotRelation();