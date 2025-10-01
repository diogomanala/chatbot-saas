require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLatestMessage() {
  try {
    console.log('📱 [MESSAGES] Verificando última mensagem...');
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return;
    }

    if (messages && messages.length > 0) {
      const message = messages[0];
      console.log('\n✅ [ÚLTIMA MENSAGEM]');
      console.log('   ID:', message.id);
      console.log('   Telefone:', message.phone_number);
      console.log('   Conteúdo:', message.message_content);
      console.log('   Direção:', message.direction);
      console.log('   Status:', message.status);
      console.log('   Tokens Usados:', message.tokens_used);
      console.log('   Custo (Créditos):', message.cost_credits);
      console.log('   Status de Cobrança:', message.billing_status);
      console.log('   Criado em:', message.created_at);
      console.log('   Cobrado em:', message.charged_at);
    } else {
      console.log('❌ Nenhuma mensagem encontrada');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkLatestMessage();