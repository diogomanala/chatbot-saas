const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getChatSessionsStructure() {
  try {
    console.log('Consultando estrutura da tabela chat_sessions...');
    
    // Tentar inserir um registro vazio para ver quais colunas são obrigatórias
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({})
      .select();
    
    if (error) {
      console.log('Erro ao inserir (esperado):', error.message);
      console.log('Detalhes do erro:', error.details);
      console.log('Hint:', error.hint);
      
      // Tentar uma consulta simples para ver a estrutura
      const { data: selectData, error: selectError } = await supabase
        .from('chat_sessions')
        .select('*')
        .limit(0);
        
      if (selectError) {
        console.log('Erro na consulta:', selectError.message);
      } else {
        console.log('Consulta vazia executada com sucesso');
      }
    } else {
      console.log('Inserção bem-sucedida (inesperado):', data);
    }
  } catch (err) {
    console.error('Erro:', err.message);
  }
}

getChatSessionsStructure();