require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listChatbots() {
  try {
    console.log('🤖 Listando chatbots...');
    
    const { data: chatbots, error } = await supabase
      .from('chatbots')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erro ao buscar chatbots:', error);
      return;
    }
    
    console.log(`\n📊 Total de chatbots: ${chatbots.length}\n`);
    
    chatbots.forEach((chatbot, index) => {
      console.log(`${index + 1}. Chatbot:`);
      console.log(`   ID: ${chatbot.id}`);
      console.log(`   Nome: ${chatbot.name}`);
      console.log(`   Org ID: ${chatbot.org_id}`);
      console.log(`   Ativo: ${chatbot.is_active}`);
      console.log(`   Default: ${chatbot.is_default}`);
      console.log(`   Criado em: ${chatbot.created_at}`);
      console.log(`   Atualizado em: ${chatbot.updated_at}`);
      console.log('---');
    });
    
    // Verificar chatbots ativos por organização
    console.log('\n🔍 Chatbots ativos por organização:');
    const activeByOrg = {};
    chatbots.filter(c => c.is_active).forEach(chatbot => {
      if (!activeByOrg[chatbot.org_id]) {
        activeByOrg[chatbot.org_id] = [];
      }
      activeByOrg[chatbot.org_id].push(chatbot);
    });
    
    Object.keys(activeByOrg).forEach(orgId => {
      console.log(`   Org ${orgId}: ${activeByOrg[orgId].length} chatbot(s) ativo(s)`);
      activeByOrg[orgId].forEach(chatbot => {
        console.log(`     - ${chatbot.name} (ID: ${chatbot.id}, Default: ${chatbot.is_default})`);
      });
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

listChatbots();