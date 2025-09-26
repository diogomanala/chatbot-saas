const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSessions() {
  try {
    console.log('🔍 Verificando sessões criadas...');
    
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (error) {
      console.error('❌ Erro:', error);
    } else {
      console.log(`📋 Sessões encontradas: ${data.length}`);
      data.forEach(session => {
        console.log(`- ID: ${session.id}`);
        console.log(`  Telefone: ${session.phone_number}`);
        console.log(`  Fluxo ativo: ${session.active_flow_id}`);
        console.log(`  Passo atual: ${session.current_step_id}`);
        console.log(`  Status: ${session.status}`);
        console.log(`  Session Token: ${session.session_token}`);
        console.log(`  Criado em: ${session.created_at}`);
        console.log('---');
      });
    }
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

checkSessions();