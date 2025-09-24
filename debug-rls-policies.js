const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugRLSPolicies() {
  console.log('🔍 Debugando políticas RLS que causam erro text = uuid...\n');

  try {
    // Primeiro, vamos tentar inserir uma mensagem outbound com debug detalhado
    console.log('1. Tentando inserir mensagem outbound com debug...');
    
    const testMessage = {
      org_id: 'b985ced2-5605-42b9-bd8e-b2c72cd6164f',
      chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b', 
      device_id: '9d166619-e7cf-4f5e-9637-65c6f4d2481f',
      phone_number: '+5511999999999',
      message_content: 'Debug test message',
      direction: 'outbound',
      external_id: 'debug_test_' + Date.now(),
      billing_status: 'pending'
    };

    console.log('   Dados da mensagem:', JSON.stringify(testMessage, null, 2));

    const { data, error } = await supabase
      .from('messages')
      .insert(testMessage)
      .select();

    if (error) {
      console.error('   ❌ Erro detalhado:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
    } else {
      console.log('   ✅ Sucesso:', data);
    }

    // Agora vamos tentar desabilitar RLS temporariamente para ver se é isso
    console.log('\n2. Testando com service role (bypass RLS)...');
    
    const supabaseServiceRole = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: serviceData, error: serviceError } = await supabaseServiceRole
      .from('messages')
      .insert({
        ...testMessage,
        external_id: 'service_test_' + Date.now()
      })
      .select();

    if (serviceError) {
      console.error('   ❌ Erro com service role:', {
        code: serviceError.code,
        message: serviceError.message,
        details: serviceError.details
      });
    } else {
      console.log('   ✅ Sucesso com service role:', serviceData[0].id);
    }

    // Vamos verificar os tipos das colunas
    console.log('\n3. Verificando tipos das colunas...');
    
    const { data: columnInfo, error: columnError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'messages' 
          AND column_name IN ('org_id', 'chatbot_id', 'device_id')
          ORDER BY column_name;
        `
      });

    if (columnError) {
      console.log('   ⚠️  Não foi possível verificar tipos das colunas');
    } else {
      console.log('   📋 Tipos das colunas:', columnInfo);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

debugRLSPolicies();