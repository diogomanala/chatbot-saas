require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrgFields() {
  try {
    console.log('🔍 Verificando campos da tabela organizations...');
    
    // Buscar uma organização para ver todos os campos
    const { data: org, error } = await supabase
      .from('organizations')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Erro ao buscar organização:', error);
      return;
    }

    console.log('\n📋 Campos encontrados na tabela organizations:');
    console.log('=' .repeat(60));
    
    Object.keys(org).sort().forEach(field => {
      const value = org[field];
      const type = typeof value;
      let displayValue = value;
      
      if (type === 'object' && value !== null) {
        displayValue = JSON.stringify(value);
      } else if (value === null) {
        displayValue = 'NULL';
      } else if (typeof value === 'string' && value.length > 30) {
        displayValue = value.substring(0, 30) + '...';
      }
      
      console.log(`${field.padEnd(20)} | ${type.padEnd(10)} | ${displayValue}`);
    });
    
    console.log('=' .repeat(60));
    console.log(`\n✅ Total de ${Object.keys(org).length} campos encontrados`);
    
  } catch (error) {
    console.error('Erro:', error);
  }
}

checkOrgFields();