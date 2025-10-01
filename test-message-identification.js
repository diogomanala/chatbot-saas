const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMessageIdentification() {
  console.log('🔍 Testando identificação de mensagens para cobrança...\n');

  try {
    // 1. Buscar mensagens recentes
    console.log('📋 Buscando mensagens recentes...');
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, direction, message_content, billing_status, tokens_used, cost_credits, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return;
    }

    console.log(`✅ Encontradas ${messages?.length || 0} mensagens\n`);

    // 2. Analisar cada mensagem
    messages?.forEach((msg, index) => {
      console.log(`${index + 1}. ID: ${msg.id}`);
      console.log(`   Direção: ${msg.direction}`);
      console.log(`   Status de Cobrança: ${msg.billing_status || 'null'}`);
      console.log(`   Tokens: ${msg.tokens_used || 0}`);
      console.log(`   Créditos: ${msg.cost_credits || 0}`);
      console.log(`   Conteúdo: "${(msg.message_content || '').substring(0, 50)}..."`);
      console.log(`   Criado em: ${msg.created_at}`);
      
      // Identificar se deve ser cobrada
      const shouldBeCharged = msg.direction === 'outbound' && msg.billing_status !== 'skipped';
      console.log(`   🎯 Deve ser cobrada: ${shouldBeCharged ? 'SIM' : 'NÃO'}`);
      
      if (shouldBeCharged) {
        if (msg.billing_status === 'charged') {
          console.log('   ✅ Já foi cobrada');
        } else if (msg.billing_status === 'pending') {
          console.log('   ⏳ Aguardando cobrança');
        } else if (msg.billing_status === 'failed') {
          console.log('   ❌ Cobrança falhou');
        } else if (!msg.billing_status) {
          console.log('   🚨 SEM STATUS DE COBRANÇA - PRECISA SER CORRIGIDA');
        }
      }
      
      console.log('');
    });

    // 3. Estatísticas de billing_status
    console.log('📊 Estatísticas de Status de Cobrança:');
    const { data: stats, error: statsError } = await supabase
      .from('messages')
      .select('billing_status, direction')
      .order('created_at', { ascending: false })
      .limit(100);

    if (statsError) {
      console.error('❌ Erro ao buscar estatísticas:', statsError);
      return;
    }

    const statusCount = {};
    const directionCount = { inbound: 0, outbound: 0 };

    stats?.forEach(msg => {
      const status = msg.billing_status || 'null';
      statusCount[status] = (statusCount[status] || 0) + 1;
      directionCount[msg.direction] = (directionCount[msg.direction] || 0) + 1;
    });

    console.log('\n📈 Por Status de Cobrança:');
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} mensagens`);
    });

    console.log('\n📈 Por Direção:');
    Object.entries(directionCount).forEach(([direction, count]) => {
      console.log(`   ${direction}: ${count} mensagens`);
    });

    // 4. Identificar mensagens problemáticas
    console.log('\n🚨 Mensagens Outbound sem billing_status:');
    const { data: problematicMessages, error: probError } = await supabase
      .from('messages')
      .select('id, direction, message_content, billing_status, created_at')
      .eq('direction', 'outbound')
      .is('billing_status', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (probError) {
      console.error('❌ Erro ao buscar mensagens problemáticas:', probError);
      return;
    }

    if (problematicMessages && problematicMessages.length > 0) {
      console.log(`❌ Encontradas ${problematicMessages.length} mensagens outbound sem billing_status:`);
      problematicMessages.forEach((msg, index) => {
        console.log(`   ${index + 1}. ID: ${msg.id} | Criado: ${msg.created_at}`);
        console.log(`      Conteúdo: "${(msg.message_content || '').substring(0, 50)}..."`);
      });
    } else {
      console.log('✅ Todas as mensagens outbound têm billing_status definido');
    }

    console.log('\n🎯 RESUMO DA IDENTIFICAÇÃO:');
    console.log('✅ Mensagens INBOUND devem ter billing_status = "skipped"');
    console.log('✅ Mensagens OUTBOUND devem ter billing_status = "pending" inicialmente');
    console.log('✅ Após processamento, outbound deve ser "charged", "failed" ou "skipped"');
    console.log('❌ Mensagens outbound sem billing_status precisam ser corrigidas');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar o teste
testMessageIdentification();