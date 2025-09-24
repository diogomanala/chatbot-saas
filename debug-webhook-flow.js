const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugWebhookFlow() {
  try {
    console.log('🔍 DEBUGANDO FLUXO COMPLETO DO WEBHOOK\n');

    // 1. Verificar se existem organizações
    console.log('1️⃣ Verificando organizações...');
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(5);

    if (orgsError) {
      console.error('❌ Erro ao buscar organizações:', orgsError);
      return;
    }

    console.log(`📊 Encontradas ${orgs?.length || 0} organizações:`);
    orgs?.forEach(org => {
      console.log(`   - ${org.id}: ${org.name}`);
    });

    if (!orgs || orgs.length === 0) {
      console.log('❌ Nenhuma organização encontrada. O webhook não funcionará.');
      return;
    }

    // 2. Verificar devices/chatbots
    console.log('\n2️⃣ Verificando devices/chatbots...');
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('id, name, org_id, session_name, instance_id')
      .limit(5);

    if (devicesError) {
      console.error('❌ Erro ao buscar devices:', devicesError);
      return;
    }

    console.log(`📱 Encontrados ${devices?.length || 0} devices:`);
    devices?.forEach(device => {
      console.log(`   - ${device.id}: ${device.name} (${device.session_name || device.instance_id}) - Org: ${device.org_id}`);
    });

    if (!devices || devices.length === 0) {
      console.log('❌ Nenhum device encontrado. O webhook não funcionará.');
      return;
    }

    // 3. Verificar chatbots
    console.log('\n3️⃣ Verificando chatbots...');
    const { data: chatbots, error: chatbotsError } = await supabase
      .from('chatbots')
      .select('id, name, org_id')
      .limit(5);

    if (chatbotsError) {
      console.error('❌ Erro ao buscar chatbots:', chatbotsError);
      return;
    }

    console.log(`🤖 Encontrados ${chatbots?.length || 0} chatbots:`);
    chatbots?.forEach(chatbot => {
      console.log(`   - ${chatbot.id}: ${chatbot.name} - Org: ${chatbot.org_id}`);
    });

    // 4. Verificar mensagens recentes
    console.log('\n4️⃣ Verificando mensagens recentes...');
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, direction, message_content, tokens_used, billing_status, created_at, org_id')
      .order('created_at', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      return;
    }

    console.log(`💬 Encontradas ${messages?.length || 0} mensagens recentes:`);
    messages?.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg.direction} | Tokens: ${msg.tokens_used || 0} | Status: ${msg.billing_status || 'null'} | ${msg.created_at}`);
      console.log(`      Content: ${(msg.message_content || '').substring(0, 50)}...`);
    });

    // 5. Verificar saldos de créditos
    console.log('\n5️⃣ Verificando saldos de créditos...');
    const { data: credits, error: creditsError } = await supabase
      .from('organization_credits')
      .select('org_id, balance')
      .order('balance', { ascending: false })
      .limit(5);

    if (creditsError) {
      console.error('❌ Erro ao buscar créditos:', creditsError);
      return;
    }

    console.log(`💰 Saldos de créditos:`);
    credits?.forEach(credit => {
      console.log(`   - Org ${credit.org_id}: ${credit.balance} créditos`);
    });

    // 6. Verificar últimas transações
    console.log('\n6️⃣ Verificando últimas transações...');
    const { data: transactions, error: transError } = await supabase
      .from('usage_ledger')
      .select('org_id, credits_used, channel, created_at, message_id')
      .order('created_at', { ascending: false })
      .limit(5);

    if (transError) {
      console.error('❌ Erro ao buscar transações:', transError);
    } else {
      console.log(`📋 Últimas ${transactions?.length || 0} transações:`);
      transactions?.forEach((trans, index) => {
        console.log(`   ${index + 1}. Org ${trans.org_id}: -${trans.credits_used} créditos (${trans.channel}) - ${trans.created_at}`);
      });
    }

    // 7. Simular payload do webhook
    console.log('\n7️⃣ Simulando payload do webhook...');
    
    if (devices && devices.length > 0) {
      const testDevice = devices[0];
      const testPayload = {
        event: 'messages.upsert',
        instance: testDevice.name,
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
            id: 'test_message_' + Date.now()
          },
          message: {
            conversation: 'Olá, esta é uma mensagem de teste para verificar o webhook!'
          },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: 'Usuário Teste'
        }
      };

      console.log('📤 Payload de teste criado:');
      console.log(JSON.stringify(testPayload, null, 2));

      console.log('\n✅ DIAGNÓSTICO COMPLETO:');
      console.log(`   - Organizações: ${orgs?.length || 0}`);
      console.log(`   - Devices ativos: ${devices?.length || 0}`);
      console.log(`   - Chatbots ativos: ${chatbots?.length || 0}`);
      console.log(`   - Mensagens na tabela: ${messages?.length || 0}`);
      console.log(`   - Organizações com créditos: ${credits?.length || 0}`);
      console.log(`   - Transações recentes: ${transactions?.length || 0}`);

      if (messages && messages.length === 0) {
        console.log('\n🚨 PROBLEMA IDENTIFICADO: A tabela messages está vazia!');
        console.log('   Isso indica que o webhook não está sendo chamado ou não está salvando mensagens.');
        console.log('   Verifique:');
        console.log('   1. Se a Evolution API está configurada corretamente');
        console.log('   2. Se a URL do webhook está apontando para o endpoint correto');
        console.log('   3. Se há erros no console do webhook');
      }
    }

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
  }
}

// Executar o diagnóstico
debugWebhookFlow().then(() => {
  console.log('\n🏁 Diagnóstico concluído.');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});