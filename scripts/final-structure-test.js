require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ [FINAL-STRUCTURE-ERROR] Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function finalStructureTest() {
  console.log('🎯 [FINAL-STRUCTURE] Teste final da estrutura messages...');
  
  try {
    // Buscar device real
    const { data: devices } = await supabase
      .from('devices')
      .select('id')
      .limit(1);
    
    const deviceId = devices?.[0]?.id || '00000000-0000-0000-0000-000000000000';
    
    // Campos obrigatórios: org_id, chatbot_id, device_id, phone_number, message_content
    const testPayload = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b',
      device_id: deviceId,
      phone_number: '5522997603813',
      message_content: 'Teste de mensagem',
      external_id: 'test-' + Date.now()
    };
    
    console.log('📝 [FINAL-STRUCTURE] Inserindo com todos os campos obrigatórios...');
    const { data, error } = await supabase
      .from('messages')
      .insert(testPayload)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [FINAL-STRUCTURE-ERROR]:', error);
    } else {
      console.log('✅ [FINAL-STRUCTURE-SUCCESS] Inserção funcionou!');
      console.log('📋 [FINAL-STRUCTURE] Estrutura completa da tabela messages:');
      console.log('=' .repeat(60));
      
      Object.keys(data).sort().forEach(key => {
        const value = data[key];
        const type = typeof value;
        const displayValue = type === 'object' ? JSON.stringify(value) : String(value);
        console.log(`${key.padEnd(20)} | ${type.padEnd(10)} | ${displayValue}`);
      });
      
      console.log('=' .repeat(60));
      console.log('📊 [FINAL-STRUCTURE] Campos obrigatórios identificados:');
      console.log('   - org_id (UUID)');
      console.log('   - chatbot_id (UUID)');
      console.log('   - device_id (UUID)');
      console.log('   - phone_number (string)');
      console.log('   - message_content (string)');
      
      console.log('📊 [FINAL-STRUCTURE] Campos opcionais disponíveis:');
      Object.keys(data).sort().forEach(key => {
        if (!['org_id', 'chatbot_id', 'device_id', 'phone_number', 'message_content'].includes(key)) {
          console.log(`   - ${key} (${typeof data[key]})`);
        }
      });
      
      // Limpar registro de teste
      await supabase.from('messages').delete().eq('id', data.id);
      console.log('🧹 [FINAL-STRUCTURE-CLEANUP] Registro de teste removido');
      
      console.log('\n🎉 [FINAL-STRUCTURE] Estrutura da tabela messages descoberta com sucesso!');
    }
    
  } catch (error) {
    console.error('❌ [FINAL-STRUCTURE] Erro geral:', error);
  }
}

finalStructureTest();