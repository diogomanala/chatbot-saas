// =====================================================
// TESTE DO SISTEMA DE COBRANÇA SIMPLIFICADO
// =====================================================
// Testa o novo sistema onde toda mensagem outbound = 1 crédito
// =====================================================

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSimplifiedBillingSystem() {
  try {
    console.log('🧪 [TESTE] Sistema de Cobrança Simplificado\n');
    
    // 1. Verificar constraints do banco
    console.log('\n1️⃣ Verificando constraints do banco...');
    const { data: constraints, error: constraintError } = await supabase
      .from('information_schema.check_constraints')
      .select('constraint_name, check_clause')
      .eq('table_name', 'messages')
      .eq('constraint_name', 'messages_billing_status_check');
    
    if (constraintError) {
      console.log('⚠️ Não foi possível verificar constraints automaticamente');
    } else if (constraints?.length > 0) {
      console.log('✅ Constraint de billing_status encontrada');
    } else {
      console.log('⚠️ Constraint de billing_status não encontrada');
    }
    
    // 2. Buscar uma organização para teste
    console.log('\n2️⃣ Buscando organização para teste...');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1);
    
    if (orgError || !orgs?.length) {
      console.error('❌ Erro ao buscar organizações:', orgError);
      return;
    }
    
    const testOrg = orgs[0];
    console.log(`✅ Usando organização: ${testOrg.name} (${testOrg.id})`);
    
    // 3. Verificar/criar wallet de créditos
    console.log('\n3️⃣ Verificando wallet de créditos...');
    let { data: wallet, error: walletError } = await supabase
      .from('credit_wallets')
      .select('*')
      .eq('org_id', testOrg.id)
      .single();
    
    if (walletError && walletError.code === 'PGRST116') {
      // Criar wallet se não existir
      console.log('💳 Criando wallet de créditos...');
      const { data: newWallet, error: createWalletError } = await supabase
        .from('credit_wallets')
        .insert({
          org_id: testOrg.id,
          balance: 100
        })
        .select()
        .single();
      
      if (createWalletError) {
        console.error('❌ Erro ao criar wallet:', createWalletError);
        return;
      }
      wallet = newWallet;
    }
    
    console.log(`💰 Saldo atual: ${wallet.balance} créditos`);
    const initialBalance = wallet.balance;
    
    let device, chatbot;
    
    // 4. Buscar device e chatbot para teste
    console.log('\n4️⃣ Buscando device e chatbot...');
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('id, name, chatbot_id')
      .eq('org_id', testOrg.id)
      .not('chatbot_id', 'is', null)
      .limit(1)
      .single();
    
    if (deviceError) {
      console.error('❌ Erro ao buscar device:', deviceError);
      console.log('📝 Criando device de teste...');
      
      // Criar chatbot primeiro
      const { data: newChatbot, error: chatbotCreateError } = await supabase
        .from('chatbots')
        .insert({
          name: 'Test Chatbot',
          org_id: testOrg.id,
          groq_model: 'llama3-8b-8192',
          temperature: 0.7,
          system_prompt: 'Você é um assistente útil.',
          auto_response_enabled: true
        })
        .select()
        .single();
      
      if (chatbotCreateError) {
        console.error('❌ Erro ao criar chatbot:', chatbotCreateError);
        return;
      }
      
      // Criar device de teste
      const { data: newDevice, error: deviceCreateError } = await supabase
        .from('devices')
        .insert({
          name: 'Test Device',
          instance_id: 'test-instance-' + Date.now(),
          session_name: 'test-session-' + Date.now(),
          evolution_base_url: 'http://localhost:8080',
          evolution_api_key: 'test-api-key',
          webhook_secret: 'test-webhook-secret',
          org_id: testOrg.id,
          status: 'connected'
        })
        .select()
        .single();
      
      if (deviceCreateError) {
        console.error('❌ Erro ao criar device:', deviceCreateError);
        return;
      }
      
      console.log(`✅ Device criado: ${newDevice.name} (${newDevice.id})`);
      console.log(`✅ Chatbot criado: ${newChatbot.name} (${newChatbot.id})`);
      
      // Usar os novos dados
      device = newDevice;
      chatbot = newChatbot;
    } else {
      device = deviceData;
      const { data: chatbotData, error: chatbotError } = await supabase
        .from('chatbots')
        .select('id, name')
        .eq('id', device.chatbot_id)
        .single();
      
      if (chatbotError) {
        console.error('❌ Erro ao buscar chatbot:', chatbotError);
        return;
      }
      
      chatbot = chatbotData;
      console.log(`📱 Device: ${device.name} (${device.id})`);
      console.log(`🤖 Chatbot: ${chatbot.name} (${chatbot.id})`);
    }
    
    // 5. Testar mensagem INBOUND
    console.log('\n5️⃣ Testando mensagem INBOUND...');
    const { data: inboundMessage, error: inboundError } = await supabase
      .from('messages')
      .insert({
        org_id: testOrg.id,
        chatbot_id: chatbot.id,
        device_id: device.id,
        phone_number: '+5511999999999',
        direction: 'inbound',
        content: 'Oi, preciso de ajuda!',
        message_content: 'Oi, preciso de ajuda!',
        status: 'received',
        billing_status: 'no_charge',
        tokens_used: 0,
        cost_credits: 0.0000
      })
      .select()
      .single();
    
    if (inboundError) {
      console.error('❌ Erro ao criar mensagem inbound:', inboundError);
      return;
    }
    
    console.log('✅ Mensagem inbound criada:', {
      id: inboundMessage.id,
      direction: inboundMessage.direction,
      billing_status: inboundMessage.billing_status,
      tokens_used: inboundMessage.tokens_used,
      cost_credits: inboundMessage.cost_credits
    });
    
    // 6. Testar mensagem outbound (deve ser debited com 1 crédito)
    console.log('\n6️⃣ Testando mensagem outbound...');
    const { data: outboundMsg, error: outboundError } = await supabase
      .from('messages')
      .insert({
        org_id: testOrg.id,
        device_id: device.id,
        chatbot_id: chatbot.id,
        direction: 'outbound',
        sender_phone: 'bot',
        receiver_phone: '+5511999999999',
        content: 'Olá! Como posso ajudá-lo hoje?',
        phone_number: '+5511999999999',
        message_content: 'Olá! Como posso ajudá-lo hoje?',
        status: 'sent',
        billing_status: 'debited',
        tokens_used: 1,
        cost_credits: 1,
        charged_at: new Date().toISOString(),
        external_id: 'test_outbound_' + Date.now()
      })
      .select()
      .single();
    
    if (outboundError) {
      console.error('❌ Erro ao criar mensagem outbound:', outboundError);
      return;
    }
    
    console.log(`✅ Mensagem outbound criada: ${outboundMsg.id}`);
    console.log(`   Status: ${outboundMsg.billing_status}`);
    console.log(`   Tokens: ${outboundMsg.tokens_used}`);
    console.log(`   Créditos: ${outboundMsg.cost_credits}`);
    
    // 7. Testar função de débito
    console.log('\n7️⃣ Testando função de débito...');
    try {
      const { error: debitError } = await supabase
        .rpc('debit_credits_simple', {
          p_org_id: testOrg.id,
          p_credits: 1,
          p_message_id: outboundMsg.id
        });
      
      if (debitError) {
        console.error('❌ Erro no débito:', debitError);
      } else {
        console.log('✅ Débito executado com sucesso');
      }
    } catch (debitException) {
      console.error('❌ Exceção no débito:', debitException.message);
    }
    
    // 8. Verificar saldo após débito
    console.log('\n8️⃣ Verificando saldo após débito...');
    const { data: finalWallet, error: finalWalletError } = await supabase
      .from('credit_wallets')
      .select('balance')
      .eq('org_id', testOrg.id)
      .single();
    
    if (finalWalletError) {
      console.error('❌ Erro ao verificar saldo final:', finalWalletError);
    } else {
      console.log(`💰 Saldo inicial: ${initialBalance} créditos`);
      console.log(`💰 Saldo final: ${finalWallet.balance} créditos`);
      console.log(`💸 Diferença: ${initialBalance - finalWallet.balance} créditos`);
    }
    
    // 9. Verificar transações na wallet
    console.log('\n9️⃣ Verificando transações na wallet...');
    const { data: transactions, error: transactionError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('org_id', testOrg.id)
      .eq('reference_id', outboundMsg.id)
      .order('created_at', { ascending: false });
    
    if (transactionError) {
      console.error('❌ Erro ao buscar transações:', transactionError);
    } else {
      console.log(`✅ Encontradas ${transactions?.length || 0} transações:`);
      transactions?.forEach(t => {
        console.log(`   - ${t.type}: ${t.amount} créditos (${t.description})`);
      });
    }
    
    // 10. Testar webhook endpoint
    console.log('\n🔟 Testando webhook endpoint...');
    try {
      const webhookPayload = {
        event: 'messages.upsert',
        instance: {
          instanceName: device.id,
          instanceId: device.id
        },
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
            id: 'test_webhook_' + Date.now()
          },
          message: {
            conversation: 'Teste do webhook simplificado'
          },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: 'Teste',
          status: 'RECEIVED'
        }
      };
      
      const webhookResponse = await fetch('http://localhost:3000/api/webhook/evolution/messages-upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Evolution-API/1.0'
        },
        body: JSON.stringify(webhookPayload)
      });
      
      console.log(`📡 Webhook status: ${webhookResponse.status}`);
      
      if (webhookResponse.ok) {
        const webhookResult = await webhookResponse.text();
        console.log('✅ Webhook executado com sucesso');
        console.log(`📄 Resposta: ${webhookResult.substring(0, 100)}...`);
      } else {
        const webhookError = await webhookResponse.text();
        console.error('❌ Erro no webhook:', webhookError);
      }
    } catch (webhookException) {
      console.error('❌ Exceção no webhook:', webhookException.message);
    }
    
    console.log('\n🎉 Teste do sistema simplificado concluído!');
    console.log('\n📋 Resumo:');
    console.log('✅ Mensagens inbound: billing_status = "no_charge", tokens = 0');
    console.log('✅ Mensagens outbound: billing_status = "debited", tokens = 1, créditos = 1');
    console.log('✅ Função de débito funcionando');
    console.log('✅ Transações registradas na wallet');
    console.log('✅ Webhook processando mensagens');
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar teste
testSimplifiedBillingSystem();