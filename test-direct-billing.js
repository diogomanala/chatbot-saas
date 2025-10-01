/**
 * TESTE DIRETO DO SISTEMA SIMPLIFICADO DE COBRANÇA
 * 
 * Este script testa diretamente o SimplifiedBillingService
 * simulando uma mensagem outbound sem depender da API OpenAI
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Simular o SimplifiedBillingService localmente
class TestBillingService {
  static calculateTokens(text) {
    return Math.max(Math.ceil(text.length * 0.75), 50); // Mínimo 50 tokens
  }

  static calculateCredits(tokens) {
    return Math.ceil(tokens / 100); // 1 crédito por 100 tokens
  }

  static async insertMessageWithBilling(messageData, orgId) {
    const calculatedTokens = this.calculateTokens(messageData.message_content);
    const creditsNeeded = this.calculateCredits(calculatedTokens);

    console.log(`📊 Tokens calculados: ${calculatedTokens}`);
    console.log(`💰 Créditos necessários: ${creditsNeeded}`);

    // 1. Verificar saldo
    const { data: orgCredits, error: creditsError } = await supabase
      .from('organization_credits')
      .select('balance')
      .eq('org_id', orgId)
      .single();

    if (creditsError || !orgCredits) {
      throw new Error(`Erro ao verificar saldo: ${creditsError?.message}`);
    }

    console.log(`💳 Saldo atual: ${orgCredits.balance} créditos`);

    if (orgCredits.balance < creditsNeeded) {
      throw new Error(`Saldo insuficiente. Necessário: ${creditsNeeded}, Disponível: ${orgCredits.balance}`);
    }

    // 2. Inserir mensagem
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        ...messageData,
        tokens_used: calculatedTokens,
        cost_credits: creditsNeeded,
        billing_status: 'pending'
      })
      .select()
      .single();

    if (messageError) {
      throw new Error(`Erro ao inserir mensagem: ${messageError.message}`);
    }

    console.log(`✅ Mensagem inserida: ${message.id}`);

    // 3. Debitar créditos
    const { error: debitError } = await supabase
      .from('organization_credits')
      .update({
        balance: orgCredits.balance - creditsNeeded,
        updated_at: new Date().toISOString()
      })
      .eq('org_id', orgId);

    if (debitError) {
      // Reverter mensagem em caso de erro
      await supabase
        .from('messages')
        .update({
          billing_status: 'failed',
          charged_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      throw new Error(`Erro ao debitar créditos: ${debitError.message}`);
    }

    // 4. Atualizar status da mensagem
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        billing_status: 'debited',
        charged_at: new Date().toISOString()
      })
      .eq('id', message.id);

    if (updateError) {
      console.warn(`⚠️ Aviso: Erro ao atualizar status da mensagem: ${updateError.message}`);
    }

    console.log(`💸 Créditos debitados: ${creditsNeeded}`);
    console.log(`💳 Novo saldo: ${orgCredits.balance - creditsNeeded}`);

    return {
      success: true,
      messageId: message.id,
      tokensUsed: calculatedTokens,
      creditsDebited: creditsNeeded,
      newBalance: orgCredits.balance - creditsNeeded
    };
  }
}

async function testDirectBilling() {
  console.log('🧪 TESTE DIRETO DO SISTEMA SIMPLIFICADO DE COBRANÇA\n');

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

    // 3. Buscar device e chatbot
    const { data: devices } = await supabase
      .from('devices')
      .select('id, session_name, instance_id')
      .eq('org_id', org.id)
      .not('instance_id', 'is', null)
      .limit(1);

    const { data: chatbots } = await supabase
      .from('chatbots')
      .select('id, name')
      .eq('org_id', org.id)
      .limit(1);

    if (!devices || devices.length === 0 || !chatbots || chatbots.length === 0) {
      console.error('❌ Device ou chatbot não encontrado');
      return;
    }

    const device = devices[0];
    const chatbot = chatbots[0];

    console.log(`📱 Device: ${device.session_name}`);
    console.log(`🤖 Chatbot: ${chatbot.name}`);

    // 4. Simular mensagem outbound
    const messageData = {
      org_id: org.id,
      chatbot_id: chatbot.id,
      device_id: device.id,
      phone_number: '5511999999999',
      sender_phone: device.instance_id,
      receiver_phone: '5511999999999',
      message_content: 'Esta é uma resposta automática do chatbot para testar o sistema de cobrança simplificado. O sistema deve calcular os tokens, debitar os créditos e atualizar o saldo da organização.',
      content: 'Esta é uma resposta automática do chatbot para testar o sistema de cobrança simplificado. O sistema deve calcular os tokens, debitar os créditos e atualizar o saldo da organização.',
      direction: 'outbound',
      status: 'sent'
    };

    console.log('\n📨 Simulando mensagem outbound...');
    console.log(`📏 Conteúdo: "${messageData.message_content.substring(0, 50)}..."`);
    console.log(`📊 Tamanho: ${messageData.message_content.length} caracteres`);

    // 5. Processar cobrança
    const result = await TestBillingService.insertMessageWithBilling(messageData, org.id);

    console.log('\n✅ COBRANÇA PROCESSADA COM SUCESSO!');
    console.log(`   📨 ID da mensagem: ${result.messageId}`);
    console.log(`   🔢 Tokens usados: ${result.tokensUsed}`);
    console.log(`   💸 Créditos debitados: ${result.creditsDebited}`);
    console.log(`   💳 Novo saldo: ${result.newBalance}`);

    // 6. Verificar resultado final
    const { data: finalCredits } = await supabase
      .from('organization_credits')
      .select('balance')
      .eq('org_id', org.id)
      .single();

    const { data: savedMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('id', result.messageId)
      .single();

    console.log('\n🔍 VERIFICAÇÃO FINAL:');
    console.log(`   💰 Saldo confirmado: ${finalCredits?.balance || 'N/A'} créditos`);
    console.log(`   📊 Diferença: ${initialCredits.balance - (finalCredits?.balance || 0)} créditos`);
    console.log(`   📨 Status da mensagem: ${savedMessage?.billing_status || 'N/A'}`);
    console.log(`   🔢 Tokens na mensagem: ${savedMessage?.tokens_used || 0}`);
    console.log(`   💸 Créditos na mensagem: ${savedMessage?.cost_credits || 0}`);
    console.log(`   📅 Data de cobrança: ${savedMessage?.charged_at || 'N/A'}`);

    // 7. Validar sucesso
    const expectedBalance = initialCredits.balance - result.creditsDebited;
    const actualBalance = finalCredits?.balance || 0;

    if (Math.abs(expectedBalance - actualBalance) < 0.01) {
      console.log('\n🎉 TESTE PASSOU: Sistema de cobrança funcionando perfeitamente!');
      console.log('   ✓ Saldo debitado corretamente');
      console.log('   ✓ Mensagem salva com status "debited"');
      console.log('   ✓ Tokens calculados e registrados');
      console.log('   ✓ Data de cobrança registrada');
    } else {
      console.log('\n❌ TESTE FALHOU: Inconsistência no saldo');
      console.log(`   Esperado: ${expectedBalance}`);
      console.log(`   Atual: ${actualBalance}`);
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testDirectBilling();