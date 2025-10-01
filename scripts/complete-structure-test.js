require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ [COMPLETE-ERROR] Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function completeStructureTest() {
  console.log('🎯 [COMPLETE] Teste completo da estrutura messages...');
  
  try {
    // Buscar device real
    const { data: devices } = await supabase
      .from('devices')
      .select('id')
      .limit(1);
    
    const deviceId = devices?.[0]?.id || '00000000-0000-0000-0000-000000000000';
    
    // Todos os campos obrigatórios descobertos
    const testPayload = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b',
      device_id: deviceId,
      phone_number: '5522997603813',
      message_content: 'Teste de mensagem',
      direction: 'inbound',
      external_id: 'test-' + Date.now()
    };
    
    console.log('📝 [COMPLETE] Inserindo com todos os campos obrigatórios...');
    const { data, error } = await supabase
      .from('messages')
      .insert(testPayload)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [COMPLETE-ERROR]:', error);
      
      // Se ainda há erro, tentar com type
      const withType = {
        ...testPayload,
        type: 'text'
      };
      
      console.log('🔄 [COMPLETE] Tentando com type...');
      const { data: typeData, error: typeError } = await supabase
        .from('messages')
        .insert(withType)
        .select()
        .single();
      
      if (typeError) {
        console.error('❌ [COMPLETE-TYPE-ERROR]:', typeError);
      } else {
        console.log('✅ [COMPLETE-SUCCESS] Inserção com type funcionou!');
        await displayStructure(typeData);
        await supabase.from('messages').delete().eq('id', typeData.id);
      }
    } else {
      console.log('✅ [COMPLETE-SUCCESS] Inserção funcionou!');
      await displayStructure(data);
      await supabase.from('messages').delete().eq('id', data.id);
    }
    
  } catch (error) {
    console.error('❌ [COMPLETE] Erro geral:', error);
  }
}

async function displayStructure(data) {
  console.log('📋 [COMPLETE] ESTRUTURA COMPLETA DA TABELA MESSAGES:');
  console.log('=' .repeat(80));
  
  Object.keys(data).sort().forEach(key => {
    const value = data[key];
    const type = typeof value;
    let displayValue;
    
    if (type === 'object' && value !== null) {
      displayValue = JSON.stringify(value);
    } else if (value === null) {
      displayValue = 'NULL';
    } else {
      displayValue = String(value);
    }
    
    // Truncar valores muito longos
    if (displayValue.length > 50) {
      displayValue = displayValue.substring(0, 47) + '...';
    }
    
    console.log(`${key.padEnd(25)} | ${type.padEnd(10)} | ${displayValue}`);
  });
  
  console.log('=' .repeat(80));
  
  // Identificar campos obrigatórios vs opcionais
  const requiredFields = ['org_id', 'chatbot_id', 'device_id', 'phone_number', 'message_content', 'direction'];
  
  console.log('\n📊 [COMPLETE] CAMPOS OBRIGATÓRIOS:');
  requiredFields.forEach(field => {
    if (data.hasOwnProperty(field)) {
      console.log(`   ✅ ${field} (${typeof data[field]})`);
    }
  });
  
  console.log('\n📊 [COMPLETE] CAMPOS OPCIONAIS:');
  Object.keys(data).sort().forEach(key => {
    if (!requiredFields.includes(key)) {
      const value = data[key];
      const hasValue = value !== null && value !== undefined;
      console.log(`   ${hasValue ? '📝' : '⚪'} ${key} (${typeof value}) ${hasValue ? '= ' + (typeof value === 'object' ? JSON.stringify(value) : String(value)).substring(0, 30) : ''}`);
    }
  });
  
  console.log('\n🎉 [COMPLETE] Estrutura da tabela messages mapeada com sucesso!');
  console.log('🧹 [COMPLETE] Registro de teste removido');
}

completeStructureTest();