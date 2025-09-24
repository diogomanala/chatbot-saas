const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listDevices() {
  console.log('📱 [DEVICES] Listando todos os devices...');
  
  try {
    const { data: devices, error } = await supabase
      .from('devices')
      .select('id, name, session_name, instance_id, org_id, status, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ [ERROR]', error.message);
      return;
    }
    
    if (!devices || devices.length === 0) {
      console.log('📭 [EMPTY] Nenhum device encontrado');
      return;
    }
    
    console.log(`\n📊 [COUNT] Total de devices: ${devices.length}\n`);
    
    devices.forEach((device, index) => {
      console.log(`🔹 [DEVICE ${index + 1}]`);
      console.log(`   ID: ${device.id}`);
      console.log(`   Nome: ${device.name}`);
      console.log(`   Session Name: ${device.session_name || 'N/A'}`);
      console.log(`   Instance ID: ${device.instance_id || 'N/A'}`);
      console.log(`   Org ID: ${device.org_id}`);
      console.log(`   Status: ${device.status || 'N/A'}`);
      console.log(`   Criado em: ${device.created_at}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ [EXCEPTION]', error.message);
  }
}

listDevices();