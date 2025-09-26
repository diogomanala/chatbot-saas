const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTableStructure() {
  try {
    console.log('🔍 Verificando estrutura da tabela chat_sessions...');
    
    // Tentar buscar um registro existente para ver a estrutura
    const { data: existingData, error: selectError } = await supabase
      .from('chat_sessions')
      .select('*')
      .limit(1);
    
    if (selectError) {
      console.error('❌ Erro ao consultar tabela:', selectError);
      return;
    }
    
    if (existingData && existingData.length > 0) {
      console.log('📋 Colunas encontradas na tabela:');
      Object.keys(existingData[0]).forEach(col => {
        console.log(`- ${col}: ${typeof existingData[0][col]} (valor: ${existingData[0][col]})`);
      });
    } else {
      console.log('📋 Tabela vazia, tentando inserção de teste...');
      
      // Tentar inserir com session_token
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
          chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b',
          phone_number: '5511999999999',
          session_variables: {},
          status: 'active',
          session_token: 'test-token-' + Date.now()
        })
        .select();
      
      if (error) {
        console.error('❌ Erro ao inserir com session_token:', error);
      } else {
        console.log('✅ Inserção bem-sucedida com session_token:', data);
        
        // Deletar o registro de teste
        await supabase
          .from('chat_sessions')
          .delete()
          .eq('id', data[0].id);
        console.log('🗑️ Registro de teste removido');
      }
    }
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

checkTableStructure();