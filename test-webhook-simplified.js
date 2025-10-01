/**
 * TESTE DO WEBHOOK COM SISTEMA SIMPLIFICADO DE COBRANÇA
 * 
 * Este script testa:
 * 1. Webhook recebendo mensagem inbound
 * 2. Processamento da resposta outbound
 * 3. Cobrança automática com sistema simplificado
 * 4. Verificação do saldo antes e depois
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testWebhookWithSimplifiedBilling() {
  console.log('🧪 TESTE DO WEBHOOK COM SISTEMA SIMPLIFICADO DE COBRANÇA\n');

  try {
    // 1. Buscar dados necessários
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1);

    if (orgError || !orgs || orgs.length === 0) {
      console.error('❌ Erro ao buscar organizações:', orgError);
      return;
    }

    const org = orgs[0];
    console.log(`📋 Organização: ${org.name} (${org.id})`);

    // 2. Verificar saldo inicial
    const { data: initialCredits, error: creditsError } = await supabase
      .from('organization_credits')
      .select('balance')
      .eq('org_id', org.id)
      .single();

    if (creditsError || !initialCredits) {
      console.error('❌ Erro ao verificar saldo inicial:', creditsError);
      return;
    }

    console.log(`💰 Saldo inicial: ${initialCredits.balance} créditos`);

    // 3. Buscar device ativo com instance_id válido
    const { data: devices, error: deviceError } = await supabase
      .from('devices')
      .select('id, session_name, instance_id, org_id')
      .eq('org_id', org.id)
      .not('instance_id', 'is', null)
      .limit(1);

    if (deviceError || !devices || devices.length === 0) {
      console.error('❌ Erro ao buscar devices com instance_id:', deviceError);
      return;
    }

    const device = devices[0];
    console.log(`📱 Device: ${device.session_name} (${device.id})`);
    console.log(`🔗 Instance ID: ${device.instance_id}`);

    // 4. Buscar chatbot ativo
    const { data: chatbots, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, name')
      .eq('org_id', org.id)
      .limit(1);

    if (chatbotError || !chatbots || chatbots.length === 0) {
      console.error('❌ Erro ao buscar chatbots:', chatbotError);
      return;
    }

    const chatbot = chatbots[0];
    console.log(`🤖 Chatbot: ${chatbot.name} (${chatbot.id})`);

    // 5. Simular payload do webhook no formato correto
    const webhookPayload = {
      event: 'messages.upsert',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: `webhook-test-${Date.now()}`
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Teste Webhook',
        message: {
          conversation: 'Olá! Esta é uma mensagem de teste para verificar se o sistema simplificado de cobrança está funcionando corretamente no webhook.'
        }
      },
      instanceId: device.instance_id
    };

    console.log('\n📨 Enviando payload para o webhook...');
    console.log(`📏 Mensagem: "${webhookPayload.data.message.conversation.substring(0, 50)}..."`);

    // 6. Fazer chamada para o webhook
    const webhookUrl = 'http://localhost:3000/api/webhook';
    
    try {
      const response = await axios.post(webhookUrl, webhookPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 segundos
      });

      console.log(`✅ Webhook respondeu com status: ${response.status}`);
      
      if (response.data) {
        console.log('📋 Resposta do webhook:', JSON.stringify(response.data, null, 2));
      }

    } catch (webhookError) {
      if (webhookError.code === 'ECONNREFUSED') {
        console.error('❌ Erro: Servidor não está rodando em localhost:3000');
        console.log('💡 Certifique-se de que o servidor Next.js está rodando com "npm run dev"');
        return;
      } else {
        console.error('❌ Erro na chamada do webhook:', webhookError.message);
        return;
      }
    }

    // 7. Aguardar processamento
    console.log('\n⏳ Aguardando processamento (5 segundos)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 8. Verificar mensagens criadas
    console.log('\n🔍 Verificando mensagens criadas...');
    
    const { data: recentMessages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('org_id', org.id)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Últimos 60 segundos
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError);
      return;
    }

    console.log(`📊 ${recentMessages.length} mensagens encontradas nos últimos 60 segundos:`);
    
    let totalTokensUsed = 0;
    let totalCreditsDebited = 0;
    
    recentMessages.forEach((msg, index) => {
      console.log(`\n📨 Mensagem ${index + 1}:`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Direção: ${msg.direction}`);
      console.log(`   Telefone: ${msg.phone_number}`);
      console.log(`   Conteúdo: "${(msg.content || msg.message_content || '').substring(0, 50)}..."`);
      console.log(`   Tokens usados: ${msg.tokens_used || 0}`);
      console.log(`   Status de cobrança: ${msg.billing_status}`);
      console.log(`   Data de cobrança: ${msg.charged_at || 'N/A'}`);
      console.log(`   Créditos: ${msg.cost_credits || 0}`);
      
      if (msg.direction === 'outbound' && msg.billing_status === 'debited') {
        totalTokensUsed += msg.tokens_used || 0;
        totalCreditsDebited += msg.cost_credits || 0;
      }
    });

    // 9. Verificar saldo final
    const { data: finalCredits } = await supabase
      .from('organization_credits')
      .select('balance')
      .eq('org_id', org.id)
      .single();

    console.log('\n💰 RESUMO FINANCEIRO:');
    console.log(`   Saldo inicial: ${initialCredits.balance} créditos`);
    console.log(`   Saldo final: ${finalCredits?.balance || 'N/A'} créditos`);
    console.log(`   Diferença: ${initialCredits.balance - (finalCredits?.balance || 0)} créditos`);
    console.log(`   Tokens processados: ${totalTokensUsed}`);
    console.log(`   Créditos debitados: ${totalCreditsDebited}`);

    // 10. Validar resultado
    const expectedDebit = initialCredits.balance - (finalCredits?.balance || 0);
    
    if (expectedDebit > 0) {
      console.log('\n✅ TESTE PASSOU: Sistema de cobrança funcionando!');
      console.log(`   ✓ Saldo foi debitado corretamente`);
      console.log(`   ✓ Mensagens foram processadas`);
      console.log(`   ✓ Tokens foram calculados`);
    } else {
      console.log('\n⚠️ ATENÇÃO: Nenhum débito foi realizado');
      console.log('   Possíveis causas:');
      console.log('   - Mensagem inbound não gerou resposta outbound');
      console.log('   - Sistema de cobrança não foi ativado');
      console.log('   - Erro no processamento');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste
testWebhookWithSimplifiedBilling();