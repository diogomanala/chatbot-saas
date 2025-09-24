require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Verificando mensagens outbound dos últimos 10 minutos...');
  
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('direction', 'outbound')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('❌ Erro ao buscar mensagens:', error);
    return;
  }
  
  console.log(`📊 Encontradas ${data.length} mensagens outbound:`);
  
  if (data.length === 0) {
    console.log('⚠️ Nenhuma mensagem outbound encontrada nos últimos 10 minutos');
    console.log('🔍 Isso indica que o problema pode estar na condição evolutionResponse.ok');
    return;
  }
  
  data.forEach((msg, index) => {
    console.log(`\n📝 Mensagem ${index + 1}:`);
    console.log(`   ID: ${msg.id}`);
    console.log(`   Tokens: ${msg.tokens_used}`);
    console.log(`   Status: ${msg.billing_status}`);
    console.log(`   Criada: ${msg.created_at}`);
    console.log(`   Conteúdo: ${msg.message_content?.substring(0, 100)}...`);
    
    if (msg.tokens_used === 0) {
      console.log('   ⚠️ PROBLEMA: tokens_used = 0');
    }
    
    if (msg.billing_status === 'skipped') {
      console.log('   ⚠️ PROBLEMA: billing_status = skipped');
    }
  });
  
  // Verificar se há mensagens com fallback
  const fallbackMessages = data.filter(msg => 
    msg.message_content?.includes('Desculpe, não consegui processar sua mensagem')
  );
  
  if (fallbackMessages.length > 0) {
    console.log(`\n🔄 Encontradas ${fallbackMessages.length} mensagens com fallback:`);
    fallbackMessages.forEach(msg => {
      console.log(`   - ID: ${msg.id} | Tokens: ${msg.tokens_used} | Status: ${msg.billing_status}`);
    });
  }
})();