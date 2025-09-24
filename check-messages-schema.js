const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://anlemekgocrrllsogxix.supabase.co',
  'sb_secret_PR3yVUXsopPYTE87R1L3eA_62IHitGT'
);

async function checkSchema() {
  try {
    console.log('Verificando schema da tabela messages...\n');
    
    // Verificar o schema da tabela messages
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('Erro ao consultar messages:', error);
      return;
    }
    
    console.log('Schema da tabela messages (primeira linha):');
    if (data && data.length > 0) {
      console.log(JSON.stringify(data[0], null, 2));
      console.log('\nTipos de dados das colunas:');
      Object.keys(data[0]).forEach(key => {
        const value = data[0][key];
        console.log(`${key}: ${typeof value} - ${value}`);
      });
    } else {
      console.log('Tabela messages está vazia');
    }
    
    // Tentar obter informações sobre as colunas UUID
    console.log('\n--- Verificando colunas que podem ser UUID ---');
    const { data: allData, error: allError } = await supabase
      .from('messages')
      .select('*')
      .limit(5);
      
    if (allError) {
      console.log('Erro ao consultar todas as mensagens:', allError);
    } else if (allData && allData.length > 0) {
      console.log(`Total de mensagens encontradas: ${allData.length}`);
      
      // Verificar padrões UUID nas colunas
      const firstRow = allData[0];
      Object.keys(firstRow).forEach(key => {
        const value = firstRow[key];
        if (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.log(`${key}: Parece ser UUID - ${value}`);
        }
      });
    }
    
  } catch (error) {
    console.error('Erro:', error);
  }
}

checkSchema();