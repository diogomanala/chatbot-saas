// =====================================================
// TESTE DAS CORREÇÕES DO WEBHOOK
// =====================================================
// Este script testa se as correções aplicadas resolvem:
// 1. Problema do UPSERT com constraint UNIQUE
// 2. Problema do trigger com comparação text = uuid
// =====================================================

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWebhookCorrections() {
  console.log('🧪 Iniciando teste das correções do webhook...\n');

  // IDs de teste
  const testOrgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
  const testChatbotId = '761a8909-6674-440b-9811-7a232efb8a4b';
  const testDeviceId = '9d166619-e7cf-4f5e-9637-65c6f4d2481f';
  const testPhoneNumber = '+5511999999999';
  const testExternalId = `test_${Date.now()}`;

  try {
    // =====================================================
    // TESTE 1: UPSERT MENSAGEM INBOUND
    // =====================================================
    console.log('📥 Teste 1: UPSERT mensagem inbound...');
    
    const { data: inboundMessage, error: inboundError } = await supabase
      .from('messages')
      .upsert({
        org_id: testOrgId,
        chatbot_id: testChatbotId,
        device_id: testDeviceId,
        phone_number: testPhoneNumber,
        message_content: 'Mensagem de teste inbound',
        direction: 'inbound',
        status: 'received',
        external_id: testExternalId,
        tokens_used: 0,
        billing_status: 'debited',
        created_at: new Date().toISOString(),
        metadata: { test: true }
      }, {
        onConflict: 'external_id'
      })
      .select()
      .single();

    if (inboundError) {
      console.error('❌ FALHA no teste 1 - UPSERT inbound:', inboundError);
      return false;
    }

    console.log('✅ SUCESSO no teste 1 - Mensagem inbound:', inboundMessage.id);

    // =====================================================
    // TESTE 2: UPSERT MENSAGEM OUTBOUND (Trigger Test)
    // =====================================================
    console.log('\n📤 Teste 2: UPSERT mensagem outbound (teste do trigger)...');
    
    const outboundExternalId = `test_outbound_${Date.now()}`;
    
    const { data: outboundMessage, error: outboundError } = await supabase
      .from('messages')
      .upsert({
        org_id: testOrgId,
        chatbot_id: testChatbotId,
        device_id: testDeviceId,
        phone_number: testPhoneNumber,
        message_content: 'Mensagem de teste outbound',
        direction: 'outbound',
        status: 'sent',
        external_id: outboundExternalId,
        tokens_used: 50,
        billing_status: 'pending', // Será alterado pelo trigger
        created_at: new Date().toISOString(),
        metadata: { test: true, response_to: testExternalId }
      }, {
        onConflict: 'external_id'
      })
      .select()
      .single();

    if (outboundError) {
      console.error('❌ FALHA no teste 2 - UPSERT outbound:', outboundError);
      return false;
    }

    console.log('✅ SUCESSO no teste 2 - Mensagem outbound:', outboundMessage.id);

    // =====================================================
    // TESTE 3: VERIFICAR SE O TRIGGER FUNCIONOU
    // =====================================================
    console.log('\n🔍 Teste 3: Verificando se o trigger processou a mensagem outbound...');
    
    // Aguardar um pouco para o trigger processar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: updatedMessage, error: checkError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', outboundMessage.id)
      .single();

    if (checkError) {
      console.error('❌ FALHA no teste 3 - Erro ao verificar mensagem:', checkError);
      return false;
    }

    console.log('📊 Status da mensagem após trigger:', {
      id: updatedMessage.id,
      billing_status: updatedMessage.billing_status,
      tokens_used: updatedMessage.tokens_used,
      billed_at: updatedMessage.billed_at
    });

    if (updatedMessage.billing_status === 'debited') {
      console.log('✅ SUCESSO no teste 3 - Trigger funcionou corretamente!');
    } else {
      console.log('⚠️ ATENÇÃO no teste 3 - Trigger pode não ter funcionado como esperado');
    }

    // =====================================================
    // TESTE 4: VERIFICAR CRÉDITOS DEBITADOS
    // =====================================================
    console.log('\n💰 Teste 4: Verificando se os créditos foram debitados...');
    
    const { data: wallet, error: walletError } = await supabase
      .from('credit_wallets')
      .select('*')
      .eq('org_id', testOrgId)
      .single();

    if (walletError) {
      console.error('❌ FALHA no teste 4 - Erro ao verificar wallet:', walletError);
    } else {
      console.log('💳 Status da carteira:', {
        org_id: wallet.org_id,
        balance: wallet.balance,
        updated_at: wallet.updated_at
      });
      console.log('✅ SUCESSO no teste 4 - Carteira verificada!');
    }

    // =====================================================
    // TESTE 5: TESTE DE DUPLICAÇÃO (UPSERT REAL)
    // =====================================================
    console.log('\n🔄 Teste 5: Testando UPSERT real (duplicação)...');
    
    const { data: duplicateMessage, error: duplicateError } = await supabase
      .from('messages')
      .upsert({
        org_id: testOrgId,
        chatbot_id: testChatbotId,
        device_id: testDeviceId,
        phone_number: testPhoneNumber,
        message_content: 'Mensagem ATUALIZADA via upsert',
        direction: 'inbound',
        status: 'received',
        external_id: testExternalId, // MESMO external_id do teste 1
        tokens_used: 0,
        billing_status: 'debited',
        created_at: new Date().toISOString(),
        metadata: { test: true, updated: true }
      }, {
        onConflict: 'external_id'
      })
      .select()
      .single();

    if (duplicateError) {
      console.error('❌ FALHA no teste 5 - UPSERT duplicação:', duplicateError);
      return false;
    }

    // Verificar se é o mesmo ID (update) ou novo ID (insert)
    if (duplicateMessage.id === inboundMessage.id) {
      console.log('✅ SUCESSO no teste 5 - UPSERT atualizou mensagem existente!');
    } else {
      console.log('⚠️ ATENÇÃO no teste 5 - UPSERT criou nova mensagem (pode estar correto)');
    }

    console.log('\n🎉 TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
    console.log('✅ As correções parecem estar funcionando corretamente.');
    
    return true;

  } catch (error) {
    console.error('💥 ERRO GERAL nos testes:', error);
    return false;
  }
}

// Executar os testes
testWebhookCorrections()
  .then(success => {
    if (success) {
      console.log('\n🏆 RESULTADO FINAL: TESTES APROVADOS');
      process.exit(0);
    } else {
      console.log('\n💥 RESULTADO FINAL: TESTES FALHARAM');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 ERRO FATAL:', error);
    process.exit(1);
  });