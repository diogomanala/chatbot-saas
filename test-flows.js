const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndCreateTestFlow() {
  try {
    console.log('🔍 Verificando fluxos existentes...');
    
    // Verificar fluxos existentes
    const { data: flows, error } = await supabase
      .from('flows')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Erro ao buscar fluxos:', error);
      return;
    }

    console.log(`📋 Fluxos encontrados: ${flows?.length || 0}`);
    
    if (flows && flows.length > 0) {
      flows.forEach(flow => {
        console.log(`- ID: ${flow.id}`);
        console.log(`  Nome: ${flow.name}`);
        console.log(`  Triggers: ${JSON.stringify(flow.trigger_keywords)}`);
        console.log(`  Nós: ${flow.flow_data?.nodes?.length || 0}`);
        console.log('');
      });
      return;
    }

    console.log('ℹ️ Nenhum fluxo encontrado. Criando fluxo de teste...');

    // Buscar um chatbot para associar ao fluxo
    const { data: chatbots, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, org_id, name')
      .limit(1);

    if (chatbotError || !chatbots || chatbots.length === 0) {
      console.error('❌ Erro: Nenhum chatbot encontrado para criar o fluxo de teste');
      return;
    }

    const chatbot = chatbots[0];
    console.log(`📱 Usando chatbot: ${chatbot.name} (${chatbot.id})`);

    // Criar fluxo de teste simples
    const testFlowData = {
      nodes: [
        {
          id: 'start-1',
          type: 'input',
          position: { x: 100, y: 100 },
          data: { label: 'Ponto de Início' }
        },
        {
          id: 'message-1',
          type: 'messageNode',
          position: { x: 300, y: 100 },
          data: { label: 'Olá! Bem-vindo ao nosso atendimento automatizado. Como posso ajudá-lo?' }
        },
        {
          id: 'message-2',
          type: 'messageNode',
          position: { x: 500, y: 100 },
          data: { label: 'Obrigado por entrar em contato! Nossa equipe retornará em breve.' }
        }
      ],
      edges: [
        {
          id: 'e1-2',
          source: 'start-1',
          target: 'message-1',
          type: 'smoothstep'
        },
        {
          id: 'e2-3',
          source: 'message-1',
          target: 'message-2',
          type: 'smoothstep'
        }
      ]
    };

    const { data: newFlow, error: createError } = await supabase
      .from('flows')
      .insert({
        org_id: chatbot.org_id,
        chatbot_id: chatbot.id,
        name: 'Fluxo de Teste - Boas-vindas',
        trigger_keywords: ['oi', 'olá', 'hello', 'teste'],
        flow_data: testFlowData
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar fluxo de teste:', createError);
      return;
    }

    console.log('✅ Fluxo de teste criado com sucesso!');
    console.log(`- ID: ${newFlow.id}`);
    console.log(`- Nome: ${newFlow.name}`);
    console.log(`- Triggers: ${JSON.stringify(newFlow.trigger_keywords)}`);
    console.log(`- Nós: ${newFlow.flow_data?.nodes?.length || 0}`);
    
    console.log('\n🧪 Para testar o motor de execução:');
    console.log('1. Envie uma mensagem com "oi" ou "olá" para o WhatsApp conectado');
    console.log('2. O sistema deve responder automaticamente com as mensagens do fluxo');
    console.log('3. Verifique os logs do webhook para acompanhar a execução');

  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

checkAndCreateTestFlow();