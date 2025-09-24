// Script para verificar esquema da tabela organizations
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrgSchema() {
  console.log('🔍 Verificando esquema da tabela organizations...');
  
  try {
    // Tentar buscar todas as organizações para ver as colunas
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1);
    
    if (orgError) {
      console.error('❌ Erro ao buscar organizações:', orgError);
    } else {
      console.log('✅ Organizações encontradas:', orgs?.length || 0);
      if (orgs && orgs.length > 0) {
        console.log('📋 Colunas disponíveis:', Object.keys(orgs[0]));
        console.log('📄 Exemplo de organização:', orgs[0]);
      } else {
        console.log('📋 Tabela vazia, tentando inserir com colunas mínimas...');
        
        // Tentar inserir apenas com ID e nome
        const { data: newOrg, error: insertError } = await supabase
          .from('organizations')
          .insert({
            name: 'Teste Org'
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ Erro ao inserir:', insertError);
        } else {
          console.log('✅ Organização criada:', newOrg);
          console.log('📋 Colunas da nova organização:', Object.keys(newOrg));
        }
      }
    }

  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

checkOrgSchema();