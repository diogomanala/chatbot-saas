require('dotenv').config({ path: '.env.local' });

async function testDevicesAPI() {
  console.log('🧪 [TEST] Testando API /devices...');
  
  try {
    // Simular uma requisição para a API local
    const response = await fetch('http://localhost:3000/api/devices', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY || 'test'}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 [STATUS] Status da resposta:', response.status);
    console.log('📊 [HEADERS] Headers da resposta:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ [SUCCESS] Dados retornados:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.devices && data.devices.length > 0) {
        console.log('\n📱 [DEVICES] Dispositivos encontrados:');
        data.devices.forEach((device, index) => {
          console.log(`${index + 1}. ${device.name}`);
          console.log(`   ID: ${device.id}`);
          console.log(`   Session: ${device.session_name}`);
          console.log(`   Status: ${device.status}`);
          console.log(`   Criado: ${device.created_at}`);
          console.log(`   Atualizado: ${device.updated_at}`);
          console.log('');
        });
      }
    } else {
      const errorData = await response.text();
      console.log('❌ [ERROR] Erro na resposta:', errorData);
    }
    
  } catch (error) {
    console.error('❌ [ERROR] Erro na requisição:', error.message);
  }
}

testDevicesAPI();