const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkChatbots() {
  try {
    console.log('Verificando chatbots no banco de dados...');
    
    const { data: chatbots, error } = await supabase
      .from('chatbots')
      .select('id, name, is_active, org_id, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar chatbots:', error);
      return;
    }
    
    console.log('\n=== ESTADO ATUAL DOS CHATBOTS ===');
    console.log(`Total de chatbots: ${chatbots?.length || 0}`);
    
    if (chatbots && chatbots.length > 0) {
      const activeChatbots = chatbots.filter(bot => bot.is_active);
      console.log(`Chatbots ativos: ${activeChatbots.length}`);
      
      console.log('\nDetalhes:');
      chatbots.forEach(bot => {
        console.log(`- ${bot.name} (ID: ${bot.id}) - ${bot.is_active ? 'ATIVO' : 'INATIVO'} - Org: ${bot.org_id}`);
      });
      
      if (activeChatbots.length > 1) {
        console.log('\n⚠️  PROBLEMA DETECTADO: Múltiplos chatbots ativos!');
        console.log('Chatbots ativos:');
        activeChatbots.forEach(bot => {
          console.log(`  - ${bot.name} (ID: ${bot.id})`);
        });
      } else if (activeChatbots.length === 1) {
        console.log('\n✅ Estado correto: Apenas um chatbot ativo.');
      } else {
        console.log('\n⚠️  Nenhum chatbot ativo.');
      }
    }
  } catch (error) {
    console.error('Erro:', error);
  }
}

checkChatbots();