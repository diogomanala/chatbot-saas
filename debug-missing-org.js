const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMissingOrg() {
  try {
    console.log('Conectado ao Supabase');

    // Buscar mensagens pendentes SEM org_id
    const { data: messagesWithoutOrg, error } = await supabase
      .from('messages')
      .select('id, direction, message_content, billing_status, tokens_used, created_at, org_id, chatbot_id')
      .or('billing_status.eq.pending,billing_status.is.null')
      .is('org_id', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Erro ao buscar mensagens sem org_id:', error);
      return;
    }

    console.log('\n=== MENSAGENS PENDENTES SEM ORG_ID ===');
    console.log(`Total encontradas: ${messagesWithoutOrg?.length || 0}`);
    
    messagesWithoutOrg?.forEach((row, index) => {
      console.log(`\n${index + 1}. ID: ${row.id}`);
      console.log(`   Direção: ${row.direction}`);
      console.log(`   Conteúdo: ${row.message_content?.substring(0, 50)}...`);
      console.log(`   Status Cobrança: ${row.billing_status}`);
      console.log(`   Tokens: ${row.tokens_used}`);
      console.log(`   Org ID: ${row.org_id}`);
      console.log(`   Chatbot ID: ${row.chatbot_id}`);
      console.log(`   Data: ${row.created_at}`);
    });

    // Buscar chatbots para ver se podemos associar org_id
    if (messagesWithoutOrg?.length > 0) {
      const chatbotIds = [...new Set(messagesWithoutOrg.map(m => m.chatbot_id).filter(Boolean))];
      
      if (chatbotIds.length > 0) {
        const { data: chatbots, error: chatbotError } = await supabase
          .from('chatbots')
          .select('id, name, org_id')
          .in('id', chatbotIds);

        if (!chatbotError && chatbots) {
          console.log('\n=== CHATBOTS ASSOCIADOS ===');
          chatbots.forEach(bot => {
            console.log(`Chatbot ${bot.name} (${bot.id}) -> Org: ${bot.org_id}`);
          });

          // Sugerir correção
          console.log('\n=== SUGESTÃO DE CORREÇÃO ===');
          console.log('As mensagens podem ser associadas aos org_ids dos chatbots:');
          messagesWithoutOrg.forEach(msg => {
            const chatbot = chatbots.find(bot => bot.id === msg.chatbot_id);
            if (chatbot) {
              console.log(`Mensagem ${msg.id} -> Org ${chatbot.org_id} (via chatbot ${chatbot.name})`);
            }
          });
        }
      }
    }

  } catch (error) {
    console.error('Erro:', error);
  }
}

debugMissingOrg();