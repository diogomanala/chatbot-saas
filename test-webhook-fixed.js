require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWebhookFixed() {
  console.log('🧪 Testando webhook após correções...\n');

  try {
    // 1. Verificar se existem devices e chatbots ativos
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('id, org_id, session_name, instance_id')
      .limit(1);

    if (devicesError) {
      console.error('❌ Erro ao buscar devices:', devicesError);
      return;
    }

    if (!devices || devices.length === 0) {
      console.log('❌ Nenhum device encontrado');
      return;
    }

    const device = devices[0];
    console.log('✅ Device encontrado:', {
      id: device.id,
      org_id: device.org_id,
      session_name: device.session_name,
      instance_id: device.instance_id
    });

    // 2. Verificar chatbot ativo para a organização
    const { data: chatbots, error: chatbotsError } = await supabase
      .from('chatbots')
      .select('id, name, org_id')
      .eq('org_id', device.org_id)
      .eq('is_active', true)
      .limit(1);

    if (chatbotsError) {
      console.error('❌ Erro ao buscar chatbots:', chatbotsError);
      return;
    }

    if (!chatbots || chatbots.length === 0) {
      console.log('❌ Nenhum chatbot ativo encontrado para a organização');
      return;
    }

    const chatbot = chatbots[0];
    console.log('✅ Chatbot ativo encontrado:', {
      id: chatbot.id,
      name: chatbot.name,
      org_id: chatbot.org_id
    });

    // 3. Simular payload do webhook
    const webhookPayload = {
      instance: device.session_name,
      data: {
        key: {
          remoteJid: "5511999999999@s.whatsapp.net",
          fromMe: false,
          id: "test_message_" + Date.now()
        },
        message: {
          conversation: "Olá, preciso de ajuda com meu pedido"
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: "Usuário Teste"
      }
    };

    console.log('\n📤 Simulando webhook com payload:', JSON.stringify(webhookPayload, null, 2));

    // 4. Fazer chamada para o webhook
    const response = await fetch('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    const responseText = await response.text();
    console.log('\n📥 Resposta do webhook:');
    console.log('Status:', response.status);
    console.log('Body:', responseText);

    // 5. Verificar se a mensagem foi salva corretamente
    await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2 segundos

    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('phone_number', '5511999999999@s.whatsapp.net')
      .order('created_at', { ascending: false })
      .limit(5);

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      return;
    }

    console.log('\n📨 Mensagens encontradas:', messages?.length || 0);
    
    if (messages && messages.length > 0) {
      messages.forEach((msg, index) => {
        console.log(`\nMensagem ${index + 1}:`);
        console.log('- ID:', msg.id);
        console.log('- Direção:', msg.direction);
        console.log('- Conteúdo:', msg.message_content);
        console.log('- Tokens usados:', msg.tokens_used);
        console.log('- Tokens estimados:', msg.tokens_estimated);
        console.log('- Status de cobrança:', msg.billing_status);
        console.log('- Org ID:', msg.org_id);
        console.log('- Device ID:', msg.device_id);
        console.log('- Chatbot ID:', msg.chatbot_id);
        console.log('- Criado em:', msg.created_at);
      });
    }

    // 6. Verificar créditos da organização
    const { data: credits, error: creditsError } = await supabase
      .from('organization_credits')
      .select('balance')
      .eq('org_id', device.org_id)
      .single();

    if (creditsError) {
      console.error('❌ Erro ao buscar créditos:', creditsError);
    } else {
      console.log('\n💰 Saldo de créditos da organização:', credits.balance);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testWebhookFixed();