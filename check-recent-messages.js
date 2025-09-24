const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentMessages() {
  console.log('🔍 Verificando mensagens recentes (últimas 2 horas)...\n');
  
  try {
    // Calcular timestamp de 2 horas atrás
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    
    console.log('⏰ Buscando mensagens desde:', twoHoursAgo.toLocaleString('pt-BR'));
    console.log('⏰ Horário atual:', new Date().toLocaleString('pt-BR'));
    console.log('');
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .gte('created_at', twoHoursAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erro:', error);
      return;
    }
    
    if (!messages || messages.length === 0) {
      console.log('❌ Nenhuma mensagem encontrada nas últimas 2 horas');
      console.log('');
      
      // Verificar as últimas 5 mensagens independente do horário
      console.log('📋 Verificando as últimas 5 mensagens (qualquer horário):');
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (lastMessages && lastMessages.length > 0) {
        lastMessages.forEach((msg, index) => {
          const timestamp = new Date(msg.created_at);
          console.log(`\n📨 Mensagem ${index + 1}:`);
          console.log(`   ID: ${msg.id}`);
          console.log(`   Tipo: ${msg.direction}`);
          console.log(`   Conteúdo: "${msg.content}"`);
          console.log(`   Timestamp: ${timestamp.toLocaleString('pt-BR')}`);
          console.log(`   Device: ${msg.device_id}`);
        });
      }
      return;
    }
    
    console.log(`✅ Encontradas ${messages.length} mensagem(ns) nas últimas 2 horas:`);
    
    messages.forEach((msg, index) => {
      const timestamp = new Date(msg.created_at);
      console.log(`\n📨 Mensagem ${index + 1}:`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Tipo: ${msg.direction} (${msg.direction === 'inbound' ? 'recebida' : 'enviada'})`);
      console.log(`   De: ${msg.from_number || 'N/A'}`);
      console.log(`   Para: ${msg.to_number || 'N/A'}`);
      console.log(`   Conteúdo: "${msg.content}"`);
      console.log(`   Timestamp: ${timestamp.toLocaleString('pt-BR')}`);
      console.log(`   Device: ${msg.device_id}`);
      console.log(`   Chatbot: ${msg.chatbot_id || 'N/A'}`);
    });
    
    // Verificar se há mensagens com "Oi"
    const oiMessages = messages.filter(msg => 
      msg.content && msg.content.toLowerCase().includes('oi')
    );
    
    if (oiMessages.length > 0) {
      console.log(`\n🎯 Encontradas ${oiMessages.length} mensagem(ns) com "Oi":`);
      oiMessages.forEach((msg, index) => {
        const timestamp = new Date(msg.created_at);
        console.log(`   ${index + 1}. "${msg.content}" - ${timestamp.toLocaleString('pt-BR')}`);
      });
    } else {
      console.log('\n❌ Nenhuma mensagem com "Oi" encontrada');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar mensagens:', error.message);
  }
}

checkRecentMessages();