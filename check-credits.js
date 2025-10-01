require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Verificando estrutura da tabela organization_credits...');
  
  const { data: credits, error } = await supabase
    .from('organization_credits')
    .select('*')
    .eq('org_id', '3108d984-ed2d-44f3-a742-ca223129c5fa')
    .order('created_at', { ascending: false })
    .limit(3);
    
  if (error) {
    console.error('❌ Erro:', error);
    return;
  }
  
  console.log('📊 Estrutura da tabela organization_credits:');
  if (credits.length > 0) {
    console.log('Campos disponíveis:', Object.keys(credits[0]));
    credits.forEach((credit, index) => {
      console.log(`Registro ${index + 1}:`, credit);
    });
  } else {
    console.log('⚠️ Nenhum registro encontrado para esta organização');
    
    // Verificar se há registros em geral
    const { data: allCredits } = await supabase
      .from('organization_credits')
      .select('*')
      .limit(1);
      
    if (allCredits && allCredits.length > 0) {
      console.log('📋 Exemplo de estrutura (outro org):');
      console.log('Campos:', Object.keys(allCredits[0]));
      console.log('Exemplo:', allCredits[0]);
    } else {
      console.log('⚠️ Tabela organization_credits está vazia');
    }
  }
})();