const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFlow() {
  try {
    console.log('🔍 Verificando estrutura do fluxo de teste...');
    
    const { data, error } = await supabase
      .from('flows')
      .select('*')
      .eq('id', '1f66c8a6-e9e1-4f0e-a861-94c06b7a32ad')
      .single();
    
    if (error) {
      console.error('❌ Erro:', error);
      return;
    }
    
    console.log('📋 Estrutura do fluxo:');
    console.log('Nome:', data.name);
    console.log('Triggers:', data.trigger_keywords);
    console.log('\n🔗 Nós:');
    data.flow_data.nodes.forEach(node => {
      console.log(`- ID: ${node.id}`);
      console.log(`  Tipo: ${node.type}`);
      console.log(`  Data:`, JSON.stringify(node.data, null, 2));
      console.log('');
    });
    
    console.log('🔀 Conexões:');
    data.flow_data.edges.forEach(edge => {
      console.log(`- ${edge.source} -> ${edge.target}`);
    });
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

checkFlow();