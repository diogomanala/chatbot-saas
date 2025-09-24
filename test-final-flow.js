const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFinalFlow() {
  console.log('🔄 Testando fluxo completo após correções...\n');

  try {
    // 1. Verificar se o chatbot está ativo
    console.log('1. 🤖 Verificando status do chatbot...');
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('*')
      .eq('id', 'f99ae725-f996-483d-8813-cde922d8877a')
      .single();

    if (chatbotError) {
      console.log('   ❌ Erro ao buscar chatbot:', chatbotError.message);
      return;
    }

    console.log(`   ✅ Chatbot encontrado: ${chatbot.name}`);
    console.log(`   📊 Status: ${chatbot.is_active ? 'ATIVO' : 'INATIVO'}`);

    // 2. Verificar se o dispositivo está configurado corretamente
    console.log('\n2. 📱 Verificando configuração do dispositivo...');
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('instance_id', 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77')
      .single();

    if (deviceError) {
      console.log('   ❌ Erro ao buscar dispositivo:', deviceError.message);
      return;
    }

    console.log(`   ✅ Dispositivo encontrado: ${device.name}`);
    console.log(`   🤖 Chatbot ID: ${device.chatbot_id}`);
    console.log(`   🏢 Org ID: ${device.org_id}`);
    console.log(`   🔗 Status: ${device.status}`);

    // 3. Verificar se o mapeamento está correto
    console.log('\n3. 🔍 Verificando mapeamento...');
    const expectedChatbotId = 'f99ae725-f996-483d-8813-cde922d8877a';
    const expectedOrgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';

    if (device.chatbot_id === expectedChatbotId) {
      console.log('   ✅ Chatbot ID está correto');
    } else {
      console.log(`   ❌ Chatbot ID incorreto. Esperado: ${expectedChatbotId}, Encontrado: ${device.chatbot_id}`);
    }

    if (device.org_id === expectedOrgId) {
      console.log('   ✅ Org ID está correto');
    } else {
      console.log(`   ❌ Org ID incorreto. Esperado: ${expectedOrgId}, Encontrado: ${device.org_id}`);
    }

    // 4. Testar webhook
    console.log('\n4. 🌐 Testando webhook...');
    const webhookUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';
    
    const testMessage = {
      instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'test-' + Date.now()
        },
        message: {
          conversation: 'Teste final após correções'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Teste'
      },
      destination: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
      date_time: new Date().toISOString(),
      sender: '5511999999999',
      server_url: 'https://evolution-api.example.com',
      apikey: process.env.EVOLUTION_API_KEY,
      event: 'messages.upsert'
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testMessage)
      });

      console.log(`   📡 Status da resposta: ${response.status}`);
      
      if (response.ok) {
        const responseData = await response.json();
        console.log('   ✅ Webhook respondeu com sucesso');
        console.log('   📄 Resposta:', JSON.stringify(responseData, null, 2));
      } else {
        console.log('   ❌ Webhook retornou erro');
        const errorText = await response.text();
        console.log('   📄 Erro:', errorText);
      }
    } catch (error) {
      console.log('   ❌ Erro ao chamar webhook:', error.message);
    }

    // 5. Verificar mensagens recentes
    console.log('\n5. 📨 Verificando mensagens recentes...');
    const { data: recentMessages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chatbot_id', expectedChatbotId)
      .order('created_at', { ascending: false })
      .limit(3);

    if (messagesError) {
      console.log('   ❌ Erro ao buscar mensagens:', messagesError.message);
    } else {
      console.log(`   📊 Encontradas ${recentMessages.length} mensagens recentes:`);
      recentMessages.forEach((msg, index) => {
        const date = new Date(msg.created_at).toLocaleString('pt-BR');
        const type = msg.is_from_user ? '📥 Recebida' : '📤 Enviada';
        console.log(`      ${index + 1}. ${type} [${date}]`);
        console.log(`         💬 ${msg.content.substring(0, 50)}...`);
        console.log(`         📞 Phone: ${msg.phone_number}`);
      });
    }

    console.log('\n🎯 RESUMO FINAL:');
    console.log('==================================================');
    console.log(`✅ Chatbot ativo: ${chatbot.is_active ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Dispositivo configurado: ${device.chatbot_id === expectedChatbotId ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Webhook configurado: SIM`);
    console.log(`📊 Mensagens recentes: ${recentMessages?.length || 0}`);
    
    if (chatbot.is_active && device.chatbot_id === expectedChatbotId) {
      console.log('\n🎉 TUDO CONFIGURADO CORRETAMENTE!');
      console.log('Agora você pode enviar mensagens pelo WhatsApp e elas devem ser processadas.');
    } else {
      console.log('\n⚠️  AINDA HÁ PROBLEMAS A RESOLVER');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testFinalFlow();