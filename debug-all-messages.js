const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAllMessages() {
  try {
    console.log('Conectado ao Supabase');

    // 1. Buscar TODAS as mensagens recentes
    const { data: allMessages, error: allError } = await supabase
      .from('messages')
      .select('id, direction, message_content, billing_status, tokens_used, created_at, org_id, chatbot_id')
      .order('created_at', { ascending: false })
      .limit(10);

    if (allError) {
      console.error('Erro ao buscar todas as mensagens:', allError);
      return;
    }

    console.log('\n=== TODAS AS MENSAGENS RECENTES ===');
    allMessages?.forEach((row, index) => {
      console.log(`\n${index + 1}. ID: ${row.id}`);
      console.log(`   Direção: ${row.direction}`);
      console.log(`   Conteúdo: ${row.message_content?.substring(0, 50)}...`);
      console.log(`   Status Cobrança: ${row.billing_status}`);
      console.log(`   Tokens: ${row.tokens_used}`);
      console.log(`   Org ID: ${row.org_id}`);
      console.log(`   Chatbot ID: ${row.chatbot_id}`);
      console.log(`   Data: ${row.created_at}`);
    });

    // 2. Contar por status
    const { data: statusCount, error: statusError } = await supabase
      .from('messages')
      .select('billing_status')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!statusError && statusCount) {
      console.log('\n=== CONTAGEM POR STATUS (últimas 100) ===');
      const counts = {};
      statusCount.forEach(msg => {
        const status = msg.billing_status || 'null';
        counts[status] = (counts[status] || 0) + 1;
      });
      Object.entries(counts).forEach(([status, count]) => {
        console.log(`${status}: ${count} mensagens`);
      });
    }

    // 3. Buscar mensagens com billing_status = 'pending' especificamente
    const { data: pendingMessages, error: pendingError } = await supabase
      .from('messages')
      .select('id, direction, org_id, chatbot_id, created_at')
      .eq('billing_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!pendingError) {
      console.log('\n=== MENSAGENS COM STATUS PENDING ===');
      console.log(`Total: ${pendingMessages?.length || 0}`);
      pendingMessages?.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.id} - ${msg.direction} - org: ${msg.org_id} - chatbot: ${msg.chatbot_id}`);
      });
    }

    // 4. Buscar mensagens com billing_status = null
    const { data: nullMessages, error: nullError } = await supabase
      .from('messages')
      .select('id, direction, org_id, chatbot_id, created_at')
      .is('billing_status', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!nullError) {
      console.log('\n=== MENSAGENS COM STATUS NULL ===');
      console.log(`Total: ${nullMessages?.length || 0}`);
      nullMessages?.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.id} - ${msg.direction} - org: ${msg.org_id} - chatbot: ${msg.chatbot_id}`);
      });
    }

  } catch (error) {
    console.error('Erro:', error);
  }
}

debugAllMessages();