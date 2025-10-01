const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testTriggerFix() {
  console.log('🔧 TESTE DA CORREÇÃO DO TRIGGER DE TOKENS');
  console.log('==========================================\n');

  try {
    // 1. Verificar estado atual
    console.log('1️⃣ Estado atual das mensagens (últimas 24h):');
    const { data: currentState, error: currentError } = await supabase
      .from('messages')
      .select('id, direction, billing_status, tokens_used, tokens_estimated, created_at')
      .eq('direction', 'outbound')
      .eq('billing_status', 'debited')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (currentError) {
      console.error('❌ Erro ao buscar estado atual:', currentError);
      return;
    }

    const withoutTokens = currentState.filter(m => m.tokens_used === 0);
    const withTokens = currentState.filter(m => m.tokens_used > 0);

    console.log(`   📊 Total de mensagens: ${currentState.length}`);
    console.log(`   ❌ Sem tokens: ${withoutTokens.length} (${((withoutTokens.length / currentState.length) * 100).toFixed(1)}%)`);
    console.log(`   ✅ Com tokens: ${withTokens.length} (${((withTokens.length / currentState.length) * 100).toFixed(1)}%)`);

    if (withoutTokens.length > 0) {
      console.log('\\n   🔍 Exemplos de mensagens sem tokens:');
      withoutTokens.slice(0, 5).forEach(msg => {
        console.log(`   - ID: ${msg.id.substring(0, 8)}... | Tokens: ${msg.tokens_used} | Estimado: ${msg.tokens_estimated} | Data: ${msg.created_at}`);
      });
    }

    // 2. Simular criação de mensagem para testar trigger
    console.log('\\n2️⃣ Testando comportamento do trigger atual:');
    
    // Primeiro, vamos verificar se o trigger está ativo
    const { data: triggerInfo, error: triggerError } = await supabase
      .rpc('check_trigger_exists', { 
        trigger_name: 'messages_outbound_autodebit_ai',
        table_name: 'messages'
      })
      .single();

    if (triggerError) {
      console.log('   ⚠️  Não foi possível verificar o trigger (função check_trigger_exists não existe)');
    } else {
      console.log(`   📋 Trigger ativo: ${triggerInfo ? 'Sim' : 'Não'}`);
    }

    // 3. Análise de padrões temporais
    console.log('\\n3️⃣ Análise temporal do problema:');
    const { data: hourlyStats, error: hourlyError } = await supabase
      .from('messages')
      .select('created_at, tokens_used')
      .eq('direction', 'outbound')
      .eq('billing_status', 'debited')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!hourlyError && hourlyStats) {
      const hourlyGroups = {};
      hourlyStats.forEach(msg => {
        const hour = new Date(msg.created_at).getHours();
        if (!hourlyGroups[hour]) {
          hourlyGroups[hour] = { total: 0, withoutTokens: 0 };
        }
        hourlyGroups[hour].total++;
        if (msg.tokens_used === 0) {
          hourlyGroups[hour].withoutTokens++;
        }
      });

      console.log('   📈 Distribuição por hora (últimas 24h):');
      Object.keys(hourlyGroups)
        .sort((a, b) => b - a)
        .slice(0, 6)
        .forEach(hour => {
          const stats = hourlyGroups[hour];
          const percentage = ((stats.withoutTokens / stats.total) * 100).toFixed(1);
          console.log(`   - ${hour}h: ${stats.total} msgs, ${stats.withoutTokens} sem tokens (${percentage}%)`);
        });
    }

    // 4. Recomendações
    console.log('\\n4️⃣ Recomendações:');
    if (withoutTokens.length > 0) {
      console.log('   🚨 PROBLEMA CONFIRMADO: Há mensagens debitadas sem tokens!');
      console.log('   💡 Soluções recomendadas:');
      console.log('   1. Aplicar correção do trigger (fix-trigger-token-loss.sql)');
      console.log('   2. Corrigir mensagens existentes com tokens zerados');
      console.log('   3. Implementar monitoramento contínuo');
      
      // Calcular impacto financeiro
      const estimatedLoss = withoutTokens.length * 50; // assumindo 50 tokens por mensagem
      console.log(`   💰 Impacto estimado: ~${estimatedLoss} tokens perdidos`);
    } else {
      console.log('   ✅ Nenhum problema detectado nas últimas 24h');
    }

    // 5. Próximos passos
    console.log('\\n5️⃣ Próximos passos:');
    console.log('   1. Revisar e aplicar fix-trigger-token-loss.sql');
    console.log('   2. Monitorar mensagens após a correção');
    console.log('   3. Corrigir mensagens históricas se necessário');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testTriggerFix().then(() => {
  console.log('\\n✅ Teste concluído!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});