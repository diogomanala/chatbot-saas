/**
 * TESTE DO SISTEMA SIMPLIFICADO DE COBRANÇA
 * 
 * Este script testa:
 * 1. Inserção de mensagem com cobrança automática
 * 2. Verificação do saldo antes e depois
 * 3. Validação dos tokens e status de cobrança
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
class LocalSimplifiedBillingService {
  static calculateTokens(content, providedTokens) {
    const MIN_CHARGE_TOKENS = 100;
    
    if (providedTokens && providedTokens > 0) {
      return Math.max(providedTokens, MIN_CHARGE_TOKENS);
    }
    
    // Fórmula simples: ~4 caracteres por token + overhead mínimo
    const estimatedTokens = Math.ceil(content.length / 4) + 50;
    return Math.max(estimatedTokens, MIN_CHARGE_TOKENS);
  }

  static calculateCredits(tokens) {
    // 1000 tokens = 1 crédito (mínimo 1 crédito)
    return Math.max(Math.ceil(tokens / 1000), 1);
  }

  static async processSimplifiedBilling(options) {
    const { messageId, orgId, messageContent, tokensUsed } = options;

    try {
      console.log(`[SimplifiedBilling] 🚀 Iniciando cobrança para mensagem ${messageId}`);

      // 1. Calcular tokens
      const calculatedTokens = this.calculateTokens(messageContent, tokensUsed);
      const creditsToDebit = this.calculateCredits(calculatedTokens);

      console.log(`[SimplifiedBilling] 📊 Tokens: ${calculatedTokens}, Créditos: ${creditsToDebit}`);

      // 2. Verificar saldo atual
      const { data: orgCredits, error: balanceError } = await supabase
        .from('organization_credits')
        .select('balance')
        .eq('org_id', orgId)
        .single();

      if (balanceError || !orgCredits) {
        console.error('[SimplifiedBilling] ❌ Erro ao verificar saldo:', balanceError);
        return {
          success: false,
          message: 'Erro ao verificar saldo da organização',
          tokensCalculated: calculatedTokens,
          creditsDebited: 0,
          balanceAfter: 0
        };
      }

      const currentBalance = orgCredits.balance;
      console.log(`[SimplifiedBilling] 💰 Saldo atual: ${currentBalance}`);

      // 3. Verificar se há saldo suficiente
      if (currentBalance < creditsToDebit) {
        console.log(`[SimplifiedBilling] ⚠️ Saldo insuficiente: ${currentBalance} < ${creditsToDebit}`);
        
        // Atualizar mensagem como failed
        await supabase
          .from('messages')
          .update({
            tokens_used: calculatedTokens,
            billing_status: 'failed',
            charged_at: new Date().toISOString()
          })
          .eq('id', messageId);

        return {
          success: false,
          message: `Saldo insuficiente. Necessário: ${creditsToDebit}, Disponível: ${currentBalance}`,
          tokensCalculated: calculatedTokens,
          creditsDebited: 0,
          balanceAfter: currentBalance
        };
      }

      // 4. Debitar créditos diretamente
      const newBalance = currentBalance - creditsToDebit;
      
      const { error: debitError } = await supabase
        .from('organization_credits')
        .update({ 
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId);

      if (debitError) {
        console.error('[SimplifiedBilling] ❌ Erro ao debitar créditos:', debitError);
        return {
          success: false,
          message: 'Erro ao debitar créditos',
          tokensCalculated: calculatedTokens,
          creditsDebited: 0,
          balanceAfter: currentBalance
        };
      }

      // 5. Atualizar mensagem como debitada
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          tokens_used: calculatedTokens,
          billing_status: 'debited',
          charged_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (updateError) {
        console.error('[SimplifiedBilling] ⚠️ Erro ao atualizar mensagem (débito já realizado):', updateError);
        // Não falha aqui pois o débito já foi feito
      }

      console.log(`[SimplifiedBilling] ✅ COBRANÇA REALIZADA:`);
      console.log(`[SimplifiedBilling]    Message ID: ${messageId}`);
      console.log(`[SimplifiedBilling]    Org ID: ${orgId}`);
      console.log(`[SimplifiedBilling]    Tokens: ${calculatedTokens}`);
      console.log(`[SimplifiedBilling]    Créditos debitados: ${creditsToDebit}`);
      console.log(`[SimplifiedBilling]    Saldo antes: ${currentBalance}`);
      console.log(`[SimplifiedBilling]    Saldo depois: ${newBalance}`);

      return {
        success: true,
        message: 'Cobrança simplificada realizada com sucesso',
        tokensCalculated: calculatedTokens,
        creditsDebited: creditsToDebit,
        balanceAfter: newBalance
      };

    } catch (error) {
      console.error('[SimplifiedBilling] ❌ Erro no processamento:', error);
      return {
        success: false,
        message: `Erro interno: ${error.message}`,
        tokensCalculated: 0,
        creditsDebited: 0,
        balanceAfter: 0
      };
    }
  }

  static async insertMessageWithBilling(messageData, orgId, messageContent, tokensUsed) {
    try {
      // 1. Inserir mensagem primeiro
      const { data: insertedMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          ...messageData,
          billing_status: 'pending' // Inicia como pending
        })
        .select('*')
        .single();

      if (insertError || !insertedMessage) {
        console.error('[SimplifiedBilling] ❌ Erro ao inserir mensagem:', insertError);
        return { success: false };
      }

      // 2. Processar cobrança imediatamente
      const billingResult = await this.processSimplifiedBilling({
        messageId: insertedMessage.id,
        orgId,
        messageContent,
        tokensUsed
      });

      return {
        success: billingResult.success,
        message: insertedMessage,
        billing: billingResult
      };

    } catch (error) {
      console.error('[SimplifiedBilling] ❌ Erro na inserção com cobrança:', error);
      return { success: false };
    }
  }
}

async function testSimplifiedBilling() {
  console.log('🧪 TESTE DO SISTEMA SIMPLIFICADO DE COBRANÇA\n');

  try {
    // 1. Buscar uma organização ativa
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1);

    if (orgError || !orgs || orgs.length === 0) {
      console.error('❌ Erro ao buscar organizações:', orgError);
      return;
    }

    const org = orgs[0];
    console.log(`📋 Organização selecionada: ${org.name} (${org.id})`);

    // 2. Verificar saldo inicial
    const { data: credits, error: creditsError } = await supabase
      .from('organization_credits')
      .select('balance')
      .eq('org_id', org.id)
      .single();

    if (creditsError || !credits) {
      console.error('❌ Erro ao verificar saldo:', creditsError);
      return;
    }

    console.log(`💰 Saldo inicial: ${credits.balance} créditos\n`);

    // 3. Buscar um device ativo
    const { data: devices, error: deviceError } = await supabase
      .from('devices')
      .select('id, session_name, instance_id')
      .eq('org_id', org.id)
      .limit(1);

    if (deviceError || !devices || devices.length === 0) {
      console.error('❌ Erro ao buscar devices:', deviceError);
      return;
    }

    const device = devices[0];
    console.log(`📱 Device selecionado: ${device.session_name} (${device.id})`);

    // 4. Testar inserção com cobrança simplificada
    const testMessage = "Esta é uma mensagem de teste para verificar se o sistema simplificado de cobrança está funcionando corretamente. Vamos ver se os tokens são calculados e os créditos debitados adequadamente.";
    
    console.log(`\n📝 Testando mensagem: "${testMessage.substring(0, 50)}..."`);
    console.log(`📏 Tamanho da mensagem: ${testMessage.length} caracteres`);

    // Buscar um chatbot ativo para a mensagem
    const { data: chatbots, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id')
      .eq('org_id', org.id)
      .limit(1);

    if (chatbotError || !chatbots || chatbots.length === 0) {
      console.error('❌ Erro ao buscar chatbots:', chatbotError);
      return;
    }

    const chatbot = chatbots[0];
    console.log(`🤖 Chatbot selecionado: ${chatbot.id}`);

    const billingResult = await LocalSimplifiedBillingService.insertMessageWithBilling(
      {
        org_id: org.id,
        device_id: device.id,
        chatbot_id: chatbot.id,
        phone_number: '5511999999999',
        sender_phone: '5511999999999',
        receiver_phone: 'system',
        content: testMessage,
        message_content: testMessage,
        direction: 'outbound',
        status: 'sent',
        metadata: {
          test: true,
          timestamp: Date.now()
        }
      },
      org.id,
      testMessage
    );

    console.log('\n🎯 RESULTADO DO TESTE:');
    if (billingResult.success) {
      console.log('✅ Inserção e cobrança bem-sucedidas!');
      console.log(`📊 Tokens calculados: ${billingResult.billing.tokensCalculated}`);
      console.log(`💳 Créditos debitados: ${billingResult.billing.creditsDebited}`);
      console.log(`💰 Saldo após cobrança: ${billingResult.billing.balanceAfter}`);
      console.log(`📨 ID da mensagem: ${billingResult.message.id}`);
    } else {
      console.log('❌ Falha na inserção ou cobrança:');
      console.log(`   Erro: ${billingResult.billing?.message || 'Erro desconhecido'}`);
    }

    // 5. Verificar saldo final
    const { data: finalCredits } = await supabase
      .from('organization_credits')
      .select('balance')
      .eq('org_id', org.id)
      .single();

    console.log(`\n💰 Saldo final: ${finalCredits?.balance || 'N/A'} créditos`);
    console.log(`📉 Diferença: ${credits.balance - (finalCredits?.balance || 0)} créditos`);

    // 6. Verificar a mensagem salva
    if (billingResult.success && billingResult.message) {
      const { data: savedMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('id', billingResult.message.id)
        .single();

      console.log('\n📋 MENSAGEM SALVA:');
      console.log(`   ID: ${savedMessage.id}`);
      console.log(`   Tokens usados: ${savedMessage.tokens_used}`);
      console.log(`   Status de cobrança: ${savedMessage.billing_status}`);
      console.log(`   Data de cobrança: ${savedMessage.charged_at}`);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste
testSimplifiedBilling();