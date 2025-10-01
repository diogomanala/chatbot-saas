require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getChatbotId() {
  try {
    console.log('🔍 [BUSCANDO CHATBOT_ID]\n');
    
    // Buscar chatbots da organização
    const { data: chatbots, error } = await supabase
      .from('chatbots')
      .select('id, name, org_id')
      .limit(5);
    
    if (error) {
      console.log('❌ Erro ao buscar chatbots:', error);
      return;
    }
    
    console.log('🤖 Chatbots encontrados:');
    chatbots.forEach(bot => {
      console.log(`   - ID: ${bot.id}`);
      console.log(`     Nome: ${bot.name}`);
      console.log(`     Org ID: ${bot.org_id}`);
      console.log('');
    });
    
    if (chatbots.length > 0) {
      console.log(`✅ Use este chatbot_id: ${chatbots[0].id}`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

getChatbotId();