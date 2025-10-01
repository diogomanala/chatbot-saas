require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://anlemekgocrrllsogxix.supabase.co', 
  'sb_secret_PR3yVUXsopPYTE87R1L3eA_62IHitGT'
);

(async () => {
  try {
    const { data: devices, error } = await supabase
      .from('devices')
      .select('id, name, instance_id, status, org_id, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro:', error);
    } else {
      console.log('=== DEVICES ATIVOS ===');
      devices.forEach(device => {
        console.log(`ID: ${device.id} | Nome: ${device.name} | Instance: ${device.instance_id} | Status: ${device.status} | Org: ${device.org_id}`);
      });
      console.log(`\nTotal: ${devices.length} devices`);
    }
  } catch (err) {
    console.error('Erro na execução:', err);
  }
})();