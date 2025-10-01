const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Testando conexão com banco de dados...\n');

// Verificar variáveis de ambiente
console.log('1. Verificando variáveis de ambiente:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Definida' : '❌ Não definida');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Definida' : '❌ Não definida');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente do Supabase não estão configuradas!');
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDatabase() {
  try {
    console.log('\n2. Testando conexão básica com Supabase...');
    
    // Testar conexão básica
    const { error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro na conexão:', error.message);
      return false;
    }
    
    console.log('✅ Conexão com Supabase estabelecida');
    
    // Testar tabela devices
    console.log('\n3. Testando tabela devices...');
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .limit(5);
    
    if (devicesError) {
      console.error('❌ Erro na tabela devices:', devicesError.message);
    } else {
      console.log('✅ Tabela devices acessível');
      console.log('Devices encontrados:', devices?.length || 0);
      if (devices && devices.length > 0) {
        console.log('Primeiro device:', devices[0]);
      }
    }
    
    // Testar tabela profiles
    console.log('\n4. Testando tabela profiles...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);
    
    if (profilesError) {
      console.error('❌ Erro na tabela profiles:', profilesError.message);
    } else {
      console.log('✅ Tabela profiles acessível');
      console.log('Profiles encontrados:', profiles?.length || 0);
    }
    
    // Testar tabela conversation_history
    console.log('\n5. Testando tabela conversation_history...');
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversation_history')
      .select('*')
      .limit(5);
    
    if (conversationsError) {
      console.error('❌ Erro na tabela conversation_history:', conversationsError.message);
    } else {
      console.log('✅ Tabela conversation_history acessível');
      console.log('Conversation history encontradas:', conversations?.length || 0);
    }
    
    // Verificar se existe o device específico que está falhando
    console.log('\n6. Verificando device específico (9d166619-e7cf-4f5e-9637-65c6f4d2481f)...');
    const { data: specificDevice, error: specificError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', '9d166619-e7cf-4f5e-9637-65c6f4d2481f')
      .single();
    
    if (specificError) {
      console.error('❌ Device específico não encontrado:', specificError.message);
    } else {
      console.log('✅ Device específico encontrado:', specificDevice);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    return false;
  }
}

testDatabase()
  .then(success => {
    if (success) {
      console.log('\n✅ Teste de banco de dados concluído com sucesso!');
    } else {
      console.log('\n❌ Teste de banco de dados falhou!');
    }
  })
  .catch(error => {
    console.error('\n❌ Erro fatal:', error);
  });