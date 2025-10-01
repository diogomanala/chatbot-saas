const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkInstanceMessages() {
  console.log('🔍 Verificando mensagens por instância...\n');
  
  try {
    // Buscar todos os devices únicos
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('id, session_name, org_id, status, instance_id');
    
    if (devicesError) {
      console.error('❌ Erro ao buscar devices:', devicesError);
      return;
    }
    
    console.log('📱 Devices encontrados:');
    devices.forEach(device => {
      console.log(`   - ID: ${device.id}`);
      console.log(`     Session: ${device.session_name}`);
      console.log(`     Instance ID: ${device.instance_id}`);
      console.log(`     Status: ${device.status}`);
      console.log(`     Organização: ${device.org_id}`);
      console.log('');
    });
    
    // Para cada device, verificar quantas mensagens tem
    for (const device of devices) {
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, direction, content, created_at')
        .eq('device_id', device.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (!messagesError && messages) {
        console.log(`📨 Mensagens para device ${device.id} (${device.session_name}):`);
        console.log(`   Total de mensagens: ${messages.length}`);
        
        if (messages.length > 0) {
          console.log('   Últimas mensagens:');
          messages.forEach((msg, index) => {
            const timestamp = new Date(msg.created_at);
            console.log(`     ${index + 1}. [${msg.direction}] "${msg.content}" - ${timestamp.toLocaleString('pt-BR')}`);
          });
        }
        console.log('');
      }
    }
    
    // Verificar mensagens das últimas 2 horas por device
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    
    console.log('⏰ Mensagens das últimas 2 horas por device:');
    
    for (const device of devices) {
      const { data: recentMessages, error } = await supabase
        .from('messages')
        .select('id, direction, content, created_at')
        .eq('device_id', device.id)
        .gte('created_at', twoHoursAgo.toISOString())
        .order('created_at', { ascending: false });
      
      if (!error && recentMessages && recentMessages.length > 0) {
        console.log(`   📱 Device ${device.session_name}: ${recentMessages.length} mensagens`);
        recentMessages.forEach(msg => {
          const timestamp = new Date(msg.created_at);
          console.log(`      [${msg.direction}] "${msg.content}" - ${timestamp.toLocaleString('pt-BR')}`);
        });
      } else {
        console.log(`   📱 Device ${device.session_name}: 0 mensagens`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkInstanceMessages();