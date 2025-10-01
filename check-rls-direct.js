const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLSStatus() {
  try {
    console.log('🔍 Verificando status RLS da tabela messages...');
    
    // Verificar se RLS está habilitado na tabela
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('check_rls_status', { table_name: 'messages' });
    
    if (rlsError) {
      console.log('⚠️ Função RPC não disponível, tentando consulta direta...');
      
      // Tentar inserção direta para ver o erro
      console.log('\n🧪 Testando inserção direta na tabela messages...');
      
      const testMessage = {
        org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
        chatbot_id: 'f99ae725-f996-483d-8813-cde922d8877a',
        device_id: '9d166619-e7cf-4f5e-9637-65c6f4d2481f', // UUID válido do device
        phone_number: '5511999999999',
        contact_name: 'Teste RLS',
        message_content: 'Mensagem de teste para RLS',
        direction: 'outbound',
        external_id: 'test-external-id-' + Date.now(), // Campo obrigatório
        response_sent: true,
        tokens_used: 100,
        cost_credits: 1,
        created_at: new Date().toISOString(),
        metadata: { test: true, source: 'rls_test' }
      };
      
      const { data: insertResult, error: insertError } = await supabase
        .from('messages')
        .insert(testMessage)
        .select();
      
      if (insertError) {
        console.error('❌ Erro na inserção:', insertError);
        console.log('\n📋 Detalhes do erro:');
        console.log('- Código:', insertError.code);
        console.log('- Mensagem:', insertError.message);
        console.log('- Detalhes:', insertError.details);
        console.log('- Dica:', insertError.hint);
        
        if (insertError.code === '42501') {
          console.log('\n🔒 Erro RLS detectado! A tabela messages tem políticas de segurança que impedem a inserção.');
          console.log('💡 Possíveis soluções:');
          console.log('1. Verificar se o usuário tem permissões adequadas');
          console.log('2. Ajustar as políticas RLS da tabela');
          console.log('3. Usar service role key com bypass RLS');
        }
      } else {
        console.log('✅ Inserção bem-sucedida:', insertResult);
        
        // Limpar o registro de teste
        if (insertResult && insertResult[0]) {
          await supabase
            .from('messages')
            .delete()
            .eq('id', insertResult[0].id);
          console.log('🧹 Registro de teste removido');
        }
      }
    } else {
      console.log('✅ Status RLS:', rlsStatus);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkRLSStatus();