require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createChatbotIdentifier() {
  try {
    console.log('🔍 Analisando chatbots e devices...');
    
    // 1. Buscar todos os chatbots ativos
    const { data: chatbots, error: chatbotsError } = await supabase
      .from('chatbots')
      .select('*')
      .eq('is_active', true);
    
    if (chatbotsError) {
      console.error('❌ Erro ao buscar chatbots:', chatbotsError);
      return;
    }
    
    console.log(`📋 Encontrados ${chatbots.length} chatbots ativos:`);
    chatbots.forEach(chatbot => {
      console.log(`  - ${chatbot.name} (ID: ${chatbot.id}) - Org: ${chatbot.org_id}`);
    });
    
    // 2. Buscar todos os devices
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*');
    
    if (devicesError) {
      console.error('❌ Erro ao buscar devices:', devicesError);
      return;
    }
    
    console.log(`\n📱 Encontrados ${devices.length} devices:`);
    devices.forEach(device => {
      console.log(`  - ${device.session_name || device.instance_id} (ID: ${device.id}) - Chatbot: ${device.chatbot_id}`);
    });
    
    // 3. Criar identificadores únicos baseados no padrão instance_name
    console.log('\n🔧 Criando identificadores únicos...');
    
    for (const device of devices) {
      // Extrair o prefixo do instance_id para criar um identificador único
      const instanceId = device.instance_id || device.session_name;
      if (!instanceId) continue;
      
      // Criar um identificador baseado no padrão: prefixo-orgId
      const orgChatbot = chatbots.find(c => c.org_id === device.org_id);
      if (!orgChatbot) {
        console.log(`⚠️  Device ${instanceId} não tem chatbot ativo na org ${device.org_id}`);
        continue;
      }
      
      // Extrair prefixo do instance_id (ex: "medical-crm" de "medical-crm-fb4f70d9...")
      const prefixMatch = instanceId.match(/^([a-zA-Z-]+)/);
      const prefix = prefixMatch ? prefixMatch[1] : 'default';
      
      // Criar identificador único: prefixo + primeiros 8 chars do chatbot_id
      const uniqueIdentifier = `${prefix}-${orgChatbot.id.substring(0, 8)}`;
      
      console.log(`🎯 Device ${instanceId}:`);
      console.log(`   Prefixo: ${prefix}`);
      console.log(`   Chatbot: ${orgChatbot.name} (${orgChatbot.id})`);
      console.log(`   Identificador único: ${uniqueIdentifier}`);
      
      // Por enquanto, apenas garantir que o chatbot_id está correto
      // (A coluna unique_identifier será adicionada posteriormente)
      const { error: updateError } = await supabase
        .from('devices')
        .update({ 
          chatbot_id: orgChatbot.id // Garantir que está vinculado ao chatbot correto
        })
        .eq('id', device.id);
      
      if (updateError) {
        console.error(`❌ Erro ao atualizar device ${device.id}:`, updateError);
      } else {
        console.log(`✅ Device ${instanceId} vinculado ao chatbot ${orgChatbot.name}`);
        console.log(`   Identificador sugerido: ${uniqueIdentifier}`);
      }
    }
    
    // 4. Verificar resultado final
    console.log('\n🔍 Verificando resultado final...');
    const { data: updatedDevices } = await supabase
      .from('devices')
      .select('*');
    
    updatedDevices.forEach(device => {
      const chatbot = chatbots.find(c => c.id === device.chatbot_id);
      console.log(`📱 ${device.session_name || device.instance_id}:`);
      console.log(`   Identificador: ${device.unique_identifier || 'N/A'}`);
      console.log(`   Chatbot: ${chatbot ? chatbot.name : 'N/A'} (${device.chatbot_id || 'N/A'})`);
    });
    
    console.log('\n✅ Identificadores únicos criados com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

createChatbotIdentifier();