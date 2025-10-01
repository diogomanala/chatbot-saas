const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugOrgMessages() {
  try {
    console.log('Conectado ao Supabase');

    // Buscar as mensagens pendentes com org_id
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, direction, message_content, billing_status, tokens_used, created_at, org_id, chatbot_id')
      .or('billing_status.eq.pending,billing_status.is.null')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return;
    }

    console.log('\n=== MENSAGENS PENDENTES COM ORG_ID ===');
    messages.forEach((row, index) => {
      console.log(`\n${index + 1}. ID: ${row.id}`);
      console.log(`   Direção: ${row.direction}`);
      console.log(`   Conteúdo: ${row.message_content?.substring(0, 50)}...`);
      console.log(`   Status Cobrança: ${row.billing_status}`);
      console.log(`   Tokens: ${row.tokens_used}`);
      console.log(`   Org ID: ${row.org_id}`);
      console.log(`   Chatbot ID: ${row.chatbot_id}`);
      console.log(`   Data: ${row.created_at}`);
    });

    // Buscar organizações disponíveis
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(5);

    if (orgError) {
      console.error('Erro ao buscar organizações:', orgError);
      return;
    }

    console.log('\n=== ORGANIZAÇÕES DISPONÍVEIS ===');
    orgs.forEach((org, index) => {
      console.log(`${index + 1}. ID: ${org.id} - Nome: ${org.name}`);
    });

    // Testar a query do MessageCounter para cada org
    console.log('\n=== TESTANDO QUERY DO MESSAGE COUNTER ===');
    for (const org of orgs) {
      const { data: orgMessages, error: orgMsgError } = await supabase
        .from('messages')
        .select('id, tokens_used, message_content, created_at, chatbot_id')
        .eq('org_id', org.id)
        .eq('direction', 'outbound')
        .or('billing_status.is.null,billing_status.eq.pending')
        .order('created_at', { ascending: true });

      if (orgMsgError) {
        console.error(`Erro para org ${org.name}:`, orgMsgError);
        continue;
      }

      console.log(`Org ${org.name} (${org.id}): ${orgMessages?.length || 0} mensagens outbound pendentes`);
    }

  } catch (error) {
    console.error('Erro:', error);
  }
}

debugOrgMessages();