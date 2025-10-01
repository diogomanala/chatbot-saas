require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateSessionName() {
  console.log('🔄 Atualizando session_name no banco de dados...');
  
  try {
    // Buscar o dispositivo atual
    const { data: devices, error: fetchError } = await supabase
      .from('devices')
      .select('*')
      .eq('name', 'Device medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77')
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar dispositivo:', fetchError);
      return;
    }

    if (!devices) {
      console.error('❌ Dispositivo não encontrado');
      return;
    }

    console.log('📱 Dispositivo encontrado:', devices);

    // Atualizar o session_name para corresponder à instância conectada
    const newSessionName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    
    const { data: updatedDevice, error: updateError } = await supabase
      .from('devices')
      .update({
        session_name: newSessionName,
        instance_id: newSessionName
      })
      .eq('id', devices.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar dispositivo:', updateError);
      return;
    }

    console.log('✅ Dispositivo atualizado com sucesso!');
    console.log('📋 Dados atualizados:', updatedDevice);

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

updateSessionName();