require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDevices() {
  console.log('🔍 [VERIFICANDO DEVICES]\n');

  try {
    // Verificar se existem devices
    const { data: devices, error } = await supabase
      .from('devices')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Erro ao buscar devices:', error.message);
      return;
    }

    console.log(`📱 Total de devices encontrados: ${devices?.length || 0}`);

    if (devices && devices.length > 0) {
      console.log('\n📋 Devices disponíveis:');
      devices.forEach((device, index) => {
        console.log(`${index + 1}. ID: ${device.id}`);
        console.log(`   Org ID: ${device.org_id}`);
        console.log(`   Telefone: ${device.phone_number || 'N/A'}`);
        console.log(`   Status: ${device.status || 'N/A'}`);
        console.log(`   Criado: ${new Date(device.created_at).toLocaleString()}\n`);
      });
    } else {
      console.log('\n⚠️  Nenhum device encontrado. Vou criar um device de teste...');
      
      // Buscar uma organização existente
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .limit(1)
        .single();

      if (!orgs) {
        console.log('❌ Nenhuma organização encontrada');
        return;
      }

      console.log(`🏢 Usando organização: ${orgs.name} (${orgs.id})`);

      // Criar device de teste
      const { data: newDevice, error: createError } = await supabase
        .from('devices')
        .insert({
          org_id: orgs.id,
          phone_number: '+5511999999999',
          status: 'active',
          name: 'Device de Teste',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Erro ao criar device:', createError.message);
        return;
      }

      console.log('\n✅ Device de teste criado:');
      console.log(`   ID: ${newDevice.id}`);
      console.log(`   Org ID: ${newDevice.org_id}`);
      console.log(`   Telefone: ${newDevice.phone_number}`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }

  console.log('\n🎉 Verificação concluída!');
}

// Executar verificação
checkDevices().catch(console.error);