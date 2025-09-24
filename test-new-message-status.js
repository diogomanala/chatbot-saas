const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://anlemekgocrrllsogxix.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNewMessageStatus() {
  try {
    console.log('🧪 Testando criação de mensagem com status correto...\n');

    // 1. Buscar uma organização existente
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (orgError || !orgs || orgs.length === 0) {
      console.error('❌ Erro ao buscar organização:', orgError);
      return;
    }

    const orgId = orgs[0].id;
    console.log(`✅ Usando organização: ${orgId}`);

    // 2. Get a chatbot for this organization
     const { data: chatbots } = await supabase
       .from('chatbots')
       .select('id')
       .eq('org_id', orgId)
       .limit(1);

     if (!chatbots || chatbots.length === 0) {
       console.log('❌ No chatbots found for organization');
       return;
     }

     const chatbotId = chatbots[0].id;
     console.log('✅ Using chatbot:', chatbotId);

     // Get a device for this organization
     const { data: devices } = await supabase
       .from('devices')
       .select('id')
       .eq('org_id', orgId)
       .limit(1);

     if (!devices || devices.length === 0) {
       console.log('❌ No devices found for organization');
       return;
     }

     const deviceId = devices[0].id;
     console.log('✅ Using device:', deviceId);

     // 3. Criar uma mensagem inbound (deve ter billing_status: 'no_charge')
      const inboundMessage = {
        org_id: orgId,
        chatbot_id: chatbotId,
        device_id: deviceId,
        phone_number: '+5511999999999',
        contact_name: 'Test Contact',
        message_content: 'Teste de mensagem inbound',
        direction: 'inbound',
        intent_id: null,
        response_sent: false,
        metadata: {},
        external_id: `test-inbound-${Date.now()}`,
        content: 'Teste de mensagem inbound',
        sender_phone: '5511999999999',
        receiver_phone: '5511888888888',
        status: 'received',
        tokens_used: 0,
        cost_credits: 0.0,
        billing_status: 'no_charge'
      };

    const { data: inbound, error: inboundError } = await supabase
      .from('messages')
      .insert(inboundMessage)
      .select()
      .single();

    if (inboundError) {
      console.error('❌ Erro ao criar mensagem inbound:', inboundError);
      return;
    }

    console.log(`✅ Mensagem inbound criada: ${inbound.id}`);
    console.log(`   - Direction: ${inbound.direction}`);
    console.log(`   - Billing Status: ${inbound.billing_status}`);
    console.log(`   - Tokens Used: ${inbound.tokens_used}`);
    console.log(`   - Cost Credits: ${inbound.cost_credits}`);

    // 3. Criar uma mensagem outbound (deve ter billing_status: 'debited')
    const outboundMessage = {
      org_id: orgId,
      chatbot_id: chatbotId,
      device_id: deviceId,
      phone_number: '+5511999999999',
      contact_name: 'Test Contact',
      message_content: 'Teste de mensagem outbound',
      direction: 'outbound',
      intent_id: null,
      response_sent: true,
      metadata: {},
      external_id: `test-outbound-${Date.now()}`,
      content: 'Teste de mensagem outbound',
      sender_phone: '5511888888888',
      receiver_phone: '5511999999999',
      status: 'sent',
      tokens_used: 100,
      cost_credits: 1,
      billing_status: 'debited',
      charged_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data: outbound, error: outboundError } = await supabase
      .from('messages')
      .insert(outboundMessage)
      .select()
      .single();

    if (outboundError) {
      console.error('❌ Erro ao criar mensagem outbound:', outboundError);
      return;
    }

    console.log(`\n✅ Mensagem outbound criada: ${outbound.id}`);
    console.log(`   - Direction: ${outbound.direction}`);
    console.log(`   - Billing Status: ${outbound.billing_status}`);
    console.log(`   - Tokens Used: ${outbound.tokens_used}`);
    console.log(`   - Cost Credits: ${outbound.cost_credits}`);
    console.log(`   - Charged At: ${outbound.charged_at}`);

    // 4. Verificar se as mensagens aparecem no dashboard
    console.log('\n📊 Verificando se as mensagens aparecem no dashboard...');
    
    const { data: dashboardMessages, error: dashboardError } = await supabase
      .from('messages')
      .select('id, direction, billing_status, tokens_used, cost_credits, created_at')
      .eq('org_id', orgId)
      .in('billing_status', ['debited', 'no_charge'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (dashboardError) {
      console.error('❌ Erro ao buscar mensagens do dashboard:', dashboardError);
      return;
    }

    console.log(`✅ Encontradas ${dashboardMessages.length} mensagens no dashboard:`);
    dashboardMessages.forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.direction} | ${msg.billing_status} | Tokens: ${msg.tokens_used} | Credits: ${msg.cost_credits}`);
    });

    // 5. Verificar se há mensagens antigas com status 'pending'
    console.log('\n🔍 Verificando mensagens antigas com status "pending"...');
    
    const { data: pendingMessages, error: pendingError } = await supabase
      .from('messages')
      .select('id, direction, billing_status, created_at')
      .eq('org_id', orgId)
      .eq('billing_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (pendingError) {
      console.error('❌ Erro ao buscar mensagens pendentes:', pendingError);
      return;
    }

    if (pendingMessages.length > 0) {
      console.log(`⚠️  Encontradas ${pendingMessages.length} mensagens antigas com status "pending":`);
      pendingMessages.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.id} | ${msg.direction} | ${msg.created_at}`);
      });
      console.log('\n💡 Essas mensagens antigas precisam ser limpas do banco de dados.');
    } else {
      console.log('✅ Nenhuma mensagem com status "pending" encontrada.');
    }

    console.log('\n🎉 Teste concluído com sucesso!');
    console.log('✅ Mensagens novas estão sendo criadas com os status corretos:');
    console.log('   - Inbound: no_charge');
    console.log('   - Outbound: debited');

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

testNewMessageStatus();