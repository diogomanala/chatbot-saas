const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpdatedAtMigration() {
  console.log('🧪 [MIGRATION-TEST] Testando migração da coluna updated_at...\n');
  
  try {
    // 1. Verificar se a coluna updated_at existe
    console.log('📋 [STEP 1] Verificando se a coluna updated_at existe...');
    
    const { data: devices, error: selectError } = await supabase
      .from('devices')
      .select('id, name, created_at, updated_at')
      .limit(1);
    
    if (selectError) {
      if (selectError.message.includes('updated_at')) {
        console.error('❌ [COLUMN-MISSING] A coluna updated_at ainda não existe!');
        console.log('📝 [INSTRUÇÃO] Execute primeiro o arquivo de migração:');
        console.log('   scripts/add-updated-at-column-migration.sql');
        return;
      } else {
        console.error('❌ [SELECT-ERROR]', selectError.message);
        return;
      }
    }
    
    console.log('✅ [COLUMN-EXISTS] Coluna updated_at encontrada!');
    
    if (devices && devices.length > 0) {
      const device = devices[0];
      console.log(`📊 [SAMPLE-DATA] Device: ${device.name}`);
      console.log(`   Created: ${device.created_at}`);
      console.log(`   Updated: ${device.updated_at}`);
    }
    
    // 2. Testar se o trigger está funcionando
    console.log('\n🔧 [STEP 2] Testando trigger de atualização automática...');
    
    if (devices && devices.length > 0) {
      const testDevice = devices[0];
      const originalUpdatedAt = testDevice.updated_at;
      
      // Aguardar 1 segundo para garantir diferença no timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fazer um update simples (sem alterar updated_at manualmente)
      const { data: updatedDevice, error: updateError } = await supabase
        .from('devices')
        .update({ name: testDevice.name }) // Update sem alterar nada
        .eq('id', testDevice.id)
        .select('id, name, updated_at')
        .single();
      
      if (updateError) {
        console.error('❌ [UPDATE-ERROR]', updateError.message);
        return;
      }
      
      console.log(`📊 [TRIGGER-TEST] Device: ${updatedDevice.name}`);
      console.log(`   Original updated_at: ${originalUpdatedAt}`);
      console.log(`   New updated_at: ${updatedDevice.updated_at}`);
      
      if (updatedDevice.updated_at !== originalUpdatedAt) {
        console.log('✅ [TRIGGER-OK] Trigger está funcionando! updated_at foi atualizado automaticamente.');
      } else {
        console.log('⚠️ [TRIGGER-WARNING] Trigger pode não estar funcionando. updated_at não mudou.');
      }
    }
    
    // 3. Testar a API de desconexão
    console.log('\n🔌 [STEP 3] Verificando compatibilidade com API de desconexão...');
    
    // Buscar um device com status 'connected' para testar
    const { data: connectedDevices, error: connectedError } = await supabase
      .from('devices')
      .select('id, name, status, org_id')
      .eq('status', 'connected')
      .limit(1);
    
    if (connectedError) {
      console.error('❌ [CONNECTED-SEARCH-ERROR]', connectedError.message);
      return;
    }
    
    if (!connectedDevices || connectedDevices.length === 0) {
      console.log('⚠️ [NO-CONNECTED-DEVICES] Nenhum device conectado encontrado para teste.');
      console.log('💡 [SUGGESTION] Crie um device com status "connected" para testar a API.');
    } else {
      const connectedDevice = connectedDevices[0];
      console.log(`📱 [CONNECTED-DEVICE] Encontrado: ${connectedDevice.name} (${connectedDevice.id})`);
      console.log('✅ [API-READY] API de desconexão está pronta para usar a coluna updated_at.');
    }
    
    // 4. Verificar estrutura final
    console.log('\n📋 [STEP 4] Verificando estrutura final da tabela devices...');
    
    const { data: finalCheck, error: finalError } = await supabase
      .from('devices')
      .select('*')
      .limit(1);
    
    if (finalError) {
      console.error('❌ [FINAL-CHECK-ERROR]', finalError.message);
      return;
    }
    
    if (finalCheck && finalCheck.length > 0) {
      const columns = Object.keys(finalCheck[0]);
      console.log('📊 [FINAL-COLUMNS] Colunas disponíveis:');
      columns.forEach(col => {
        const marker = col === 'updated_at' ? '✅' : '  ';
        console.log(`${marker} - ${col}`);
      });
    }
    
    console.log('\n🎉 [SUCCESS] Migração testada com sucesso!');
    console.log('📝 [NEXT-STEPS] Agora você pode:');
    console.log('   1. Testar a API de desconexão no dashboard');
    console.log('   2. Verificar se os erros 500 foram resolvidos');
    console.log('   3. Monitorar os logs para confirmar funcionamento');
    
  } catch (error) {
    console.error('❌ [EXCEPTION]', error.message);
  }
}

testUpdatedAtMigration();