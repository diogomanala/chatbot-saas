require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugTypes() {
  console.log('🔍 Debugando tipos de dados...');
  
  // 1. Buscar organização
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .limit(1)
    .single();

  if (orgError) {
    console.error('❌ Erro ao buscar organização:', orgError);
    return;
  }

  console.log('🏢 Organização:', org);
  console.log('🔍 Tipo de org.id:', typeof org.id);
  console.log('🔍 Valor de org.id:', org.id);

  // 2. Buscar chatbot usando conversão explícita
  console.log('\n--- Testando query com conversão UUID ---');
  
  const { data: chatbot1, error: chatbotError1 } = await supabase
    .from('chatbots')
    .select('id, name, org_id')
    .eq('org_id', org.id)
    .limit(1);

  console.log('❌ Query sem conversão:', { data: chatbot1, error: chatbotError1 });

  // 3. Tentar com conversão explícita
  const { data: chatbot2, error: chatbotError2 } = await supabase
    .rpc('get_chatbots_by_org', { org_uuid: org.id });

  console.log('🔍 Query com RPC:', { data: chatbot2, error: chatbotError2 });

  // 4. Listar todos os chatbots para ver os tipos
  const { data: allChatbots, error: allError } = await supabase
    .from('chatbots')
    .select('id, name, org_id')
    .limit(5);

  console.log('\n--- Todos os chatbots ---');
  console.log('📋 Chatbots:', allChatbots);
  if (allChatbots && allChatbots.length > 0) {
    console.log('🔍 Tipo de chatbot.org_id:', typeof allChatbots[0].org_id);
    console.log('🔍 Valor de chatbot.org_id:', allChatbots[0].org_id);
  }
}

debugTypes().catch(console.error);