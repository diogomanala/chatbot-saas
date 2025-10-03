const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFlowConnections() {
  const { data: flow, error } = await supabase
    .from('flows')
    .select('*')
    .eq('name', 'teste')
    .single();
    
  if (error) {
    console.error('Erro:', error);
    return;
  }
  
  console.log('🔗 Conexões do fluxo:');
  console.log(JSON.stringify(flow.flow_data?.edges || [], null, 2));
  
  console.log('\n📊 Resumo dos nós:');
  const nodes = flow.flow_data?.nodes || [];
  nodes.forEach(node => {
    console.log(`- ${node.id} (${node.type}): ${node.data.label}`);
    if (node.type === 'message') {
      console.log(`  Mensagem: ${node.data.message}`);
    }
    if (node.type === 'options') {
      console.log(`  Pergunta: ${node.data.question}`);
      console.log(`  Opções: ${node.data.options?.join(', ')}`);
    }
  });
  
  console.log('\n🚨 Problemas identificados:');
  const edges = flow.flow_data?.edges || [];
  if (edges.length === 0) {
    console.log('❌ PROBLEMA: Não há conexões entre os nós!');
    console.log('   O fluxo não pode funcionar sem conexões.');
  }
  
  // Verificar se o nó inicial está conectado
  const startNode = nodes.find(n => n.type === 'input');
  if (startNode) {
    const hasConnection = edges.some(e => e.source === startNode.id);
    if (!hasConnection) {
      console.log('❌ PROBLEMA: O nó inicial não está conectado a nenhum outro nó!');
    }
  }
}

checkFlowConnections();