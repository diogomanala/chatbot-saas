require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWalletSchema() {
  console.log('=== VERIFICANDO SCHEMA DA TABELA CREDIT_WALLETS ===\n');
  
  // Consulta para verificar o schema da tabela
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_name', 'credit_wallets')
    .eq('table_schema', 'public');
    
  if (error) {
    console.error('Erro ao buscar schema:', error);
  } else {
    console.log('Colunas da tabela credit_wallets:');
    data.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
  }
  
  // Teste com cast explícito
  console.log('\n=== TESTANDO COM CAST EXPLÍCITO ===\n');
  
  const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
  
  // Teste de atualização com cast
  const { error: updateError } = await supabase
    .from('credit_wallets')
    .update({ balance: 1000 })
    .eq('org_id', `${orgId}::uuid`);
    
  if (updateError) {
    console.error('Erro com cast ::uuid:', updateError);
  } else {
    console.log('Sucesso com cast ::uuid');
    
    // Reverter
    await supabase
      .from('credit_wallets')
      .update({ balance: 1092.85 })
      .eq('org_id', `${orgId}::uuid`);
  }
}

checkWalletSchema().catch(console.error);