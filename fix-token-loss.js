require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixTokenLoss() {
  console.log('🔍 INVESTIGANDO PERDA DE TOKENS...\n');

  try {
    // 1. Verificar mensagens com billing_status 'charged' (antes da conversão)
    console.log('1️⃣ Mensagens com billing_status = "charged":');
    const { data: chargedMessages, error: chargedError } = await supabase
      .from('messages')
      .select('id, tokens_used, billing_status, created_at, metadata')
      .eq('billing_status', 'charged')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(10);

    if (chargedError) {
      console.error('❌ Erro ao buscar mensagens charged:', chargedError);
      return;
    }

    if (chargedMessages && chargedMessages.length > 0) {
      console.log(`   📊 Total: ${chargedMessages.length} mensagens`);
      chargedMessages.forEach(msg => {
        console.log(`   - ID: ${msg.id} | Tokens: ${msg.tokens_used} | Data: ${msg.created_at}`);
      });
    } else {
      console.log('   ✅ Nenhuma mensagem com status "charged" encontrada');
    }

    // 2. Verificar mensagens com billing_status 'debited' e tokens_used = 0
    console.log('\n2️⃣ Mensagens com billing_status = "debited" e tokens_used = 0:');
    const { data: debitedZeroMessages, error: debitedError } = await supabase
      .from('messages')
      .select('id, tokens_used, billing_status, created_at, metadata')
      .eq('billing_status', 'debited')
      .eq('direction', 'outbound')
      .eq('tokens_used', 0)
      .order('created_at', { ascending: false })
      .limit(10);

    if (debitedError) {
      console.error('❌ Erro ao buscar mensagens debited com 0 tokens:', debitedError);
      return;
    }

    if (debitedZeroMessages && debitedZeroMessages.length > 0) {
      console.log(`   📊 Total: ${debitedZeroMessages.length} mensagens problemáticas`);
      debitedZeroMessages.forEach(msg => {
        console.log(`   - ID: ${msg.id} | Tokens: ${msg.tokens_used} | Data: ${msg.created_at}`);
        if (msg.metadata && msg.metadata.tokens_from_openai) {
          console.log(`     🔥 Esta mensagem tinha tokens do OpenAI!`);
        }
      });
    } else {
      console.log('   ✅ Nenhuma mensagem problemática encontrada');
    }

    // 3. Verificar se há mensagens recentes que foram convertidas
    console.log('\n3️⃣ Verificando conversões recentes (últimas 24h):');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: recentMessages, error: recentError } = await supabase
      .from('messages')
      .select('id, tokens_used, billing_status, created_at, metadata')
      .eq('direction', 'outbound')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false });

    if (recentError) {
      console.error('❌ Erro ao buscar mensagens recentes:', recentError);
      return;
    }

    if (recentMessages) {
      const charged = recentMessages.filter(m => m.billing_status === 'charged');
      const debitedWithTokens = recentMessages.filter(m => m.billing_status === 'debited' && m.tokens_used > 0);
      const debitedWithoutTokens = recentMessages.filter(m => m.billing_status === 'debited' && m.tokens_used === 0);

      console.log(`   📊 Últimas 24h:`);
      console.log(`   - Charged: ${charged.length}`);
      console.log(`   - Debited com tokens: ${debitedWithTokens.length}`);
      console.log(`   - Debited sem tokens: ${debitedWithoutTokens.length}`);

      if (debitedWithoutTokens.length > 0) {
        console.log('\n   🔥 PROBLEMA IDENTIFICADO: Mensagens debitadas sem tokens!');
        console.log('   Estas mensagens provavelmente perderam tokens durante a conversão.');
      }
    }

    // 4. Propor solução
    console.log('\n🔧 ANÁLISE DO PROBLEMA:');
    console.log('1. Webhook salva mensagens com billing_status="charged" e tokens corretos');
    console.log('2. Algum processo (hotfix ou serviço) converte "charged" → "debited"');
    console.log('3. Durante essa conversão, os tokens são perdidos (zerados)');
    console.log('4. Resultado: mensagens debitadas mas sem tokens contabilizados');

    console.log('\n💡 SOLUÇÕES PROPOSTAS:');
    console.log('A) Corrigir o processo de conversão para preservar tokens');
    console.log('B) Modificar webhook para salvar diretamente como "debited"');
    console.log('C) Implementar validação que impede tokens_used = 0 em mensagens debitadas');

    // 5. Verificar se há um processo automático rodando
    console.log('\n5️⃣ Verificando se há processo de conversão ativo...');
    
    // Criar uma mensagem de teste para ver se é convertida
    const testMessage = {
      org_id: 'test-org',
      device_id: 'test-device',
      chatbot_id: 'test-chatbot',
      phone_number: '+5511999999999',
      message_content: 'Teste de conversão',
      direction: 'outbound',
      content: 'Teste de conversão',
      sender_phone: 'bot',
      receiver_phone: '+5511999999999',
      status: 'sent',
      tokens_used: 100, // Tokens de teste
      billing_status: 'charged', // Status inicial
      metadata: { test: true, timestamp: new Date().toISOString() }
    };

    console.log('   Criando mensagem de teste...');
    const { data: testInsert, error: testError } = await supabase
      .from('messages')
      .insert(testMessage)
      .select()
      .single();

    if (testError) {
      console.error('   ❌ Erro ao criar mensagem de teste:', testError);
    } else {
      console.log(`   ✅ Mensagem de teste criada: ID ${testInsert.id}`);
      console.log(`   Status inicial: ${testInsert.billing_status}, Tokens: ${testInsert.tokens_used}`);
      
      // Aguardar 5 segundos e verificar se foi alterada
      console.log('   Aguardando 5 segundos para verificar conversão...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const { data: testCheck, error: checkError } = await supabase
        .from('messages')
        .select('id, tokens_used, billing_status')
        .eq('id', testInsert.id)
        .single();

      if (checkError) {
        console.error('   ❌ Erro ao verificar mensagem de teste:', checkError);
      } else {
        if (testCheck.billing_status !== testInsert.billing_status || testCheck.tokens_used !== testInsert.tokens_used) {
          console.log('   🔥 CONVERSÃO DETECTADA!');
          console.log(`   Status: ${testInsert.billing_status} → ${testCheck.billing_status}`);
          console.log(`   Tokens: ${testInsert.tokens_used} → ${testCheck.tokens_used}`);
          console.log('   ⚠️  Há um processo automático convertendo mensagens!');
        } else {
          console.log('   ✅ Nenhuma conversão automática detectada');
        }
      }
      
      // Limpar mensagem de teste
      await supabase.from('messages').delete().eq('id', testInsert.id);
      console.log('   🧹 Mensagem de teste removida');
    }

  } catch (error) {
    console.error('❌ Erro na investigação:', error);
  }
}

fixTokenLoss();