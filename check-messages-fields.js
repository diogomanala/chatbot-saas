require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMessagesFields() {
  try {
    console.log('🔍 Verificando campos da tabela messages...');
    
    // Buscar uma mensagem para ver todos os campos
    const { data: message, error } = await supabase
      .from('messages')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Erro ao buscar mensagem:', error);
      return;
    }

    console.log('\n📋 Campos encontrados na tabela messages:');
    console.log('=' .repeat(60));
    
    Object.keys(message).sort().forEach(field => {
      const value = message[field];
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
    console.log(`\n✅ Total de ${Object.keys(message).length} campos encontrados`);
    
  } catch (error) {
    console.error('Erro:', error);
  }
}

checkMessagesFields();