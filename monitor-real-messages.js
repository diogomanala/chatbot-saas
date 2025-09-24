const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let lastMessageId = null;

async function monitorMessages() {
  console.log('🔍 Monitorando mensagens em tempo real...');
  console.log('📱 Envie uma mensagem para o WhatsApp agora!\n');
  
  // Pegar a última mensagem atual como referência
  const { data: initialMessages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (initialMessages && initialMessages.length > 0) {
    lastMessageId = initialMessages[0].id;
    console.log('📋 Última mensagem atual:', initialMessages[0].id);
  }
  
  // Monitorar novas mensagens a cada 2 segundos
  setInterval(async () => {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (lastMessageId) {
        // Buscar mensagens mais recentes que a última conhecida
        const { data: recentMessages } = await supabase
          .from('messages')
          .select('*')
          .gt('id', lastMessageId)
          .order('created_at', { ascending: false });
          
        if (recentMessages && recentMessages.length > 0) {
          console.log(`\n🆕 ${recentMessages.length} nova(s) mensagem(ns) detectada(s):`);
          
          recentMessages.reverse().forEach((msg, index) => {
            console.log(`\n📨 Mensagem ${index + 1}:`);
            console.log(`   ID: ${msg.id}`);
            console.log(`   Tipo: ${msg.direction} (${msg.direction === 'inbound' ? 'recebida' : 'enviada'})`);
            console.log(`   De: ${msg.from_number}`);
            console.log(`   Para: ${msg.to_number}`);
            console.log(`   Conteúdo: "${msg.content}"`);
            console.log(`   Timestamp: ${msg.created_at}`);
            console.log(`   Device: ${msg.device_id}`);
            console.log(`   Chatbot: ${msg.chatbot_id || 'N/A'}`);
          });
          
          // Atualizar o último ID
          lastMessageId = Math.max(...recentMessages.map(m => m.id));
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao monitorar:', error.message);
    }
  }, 2000);
}

console.log('🚀 Iniciando monitoramento...');
monitorMessages();

// Manter o script rodando
process.on('SIGINT', () => {
  console.log('\n👋 Parando monitoramento...');
  process.exit(0);
});