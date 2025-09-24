const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLSPolicies() {
  try {
    console.log('🔍 Verificando políticas RLS da tabela messages...');
    
    // Consulta para verificar políticas RLS
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'messages');
    
    if (error) {
      console.error('❌ Erro ao consultar políticas RLS:', error);
      return;
    }
    
    console.log('📋 Políticas RLS encontradas:', policies?.length || 0);
    
    if (policies && policies.length > 0) {
      policies.forEach((policy, index) => {
        console.log(`\n--- Política ${index + 1} ---`);
        console.log(`Nome: ${policy.policyname}`);
        console.log(`Comando: ${policy.cmd}`);
        console.log(`Permissiva: ${policy.permissive}`);
        console.log(`Roles: ${policy.roles}`);
        console.log(`Qualificação: ${policy.qual}`);
        console.log(`Com verificação: ${policy.with_check}`);
      });
    }
    
    // Tentar inserir uma mensagem de teste para ver o erro específico
    console.log('\n🧪 Testando inserção na tabela messages...');
    
    const testMessage = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      chatbot_id: 'f99ae725-f996-483d-8813-cde922d8877a',
      device_id: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
      phone_number: '5511999999999',
      contact_name: 'Teste',
      message_content: 'Mensagem de teste',
      direction: 'outbound',
      response_sent: true,
      tokens_used: 100,
      cost_credits: 1,
      created_at: new Date().toISOString(),
      metadata: { test: true }
    };
    
    const { data: insertResult, error: insertError } = await supabase
      .from('messages')
      .insert(testMessage)
      .select();
    
    if (insertError) {
      console.error('❌ Erro na inserção de teste:', insertError);
    } else {
      console.log('✅ Inserção de teste bem-sucedida:', insertResult);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkRLSPolicies();