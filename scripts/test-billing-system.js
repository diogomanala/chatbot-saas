/**
 * Script para testar o sistema completo de cobrança
 * Executa testes nos endpoints e funções SQL criadas
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas!');
  console.log('SUPABASE_URL:', supabaseUrl);
  console.log('SERVICE_KEY:', supabaseServiceKey ? 'Definida' : 'Não definida');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// URL base da aplicação
const BASE_URL = 'http://localhost:3000';

async function testBillingSystem() {
  console.log('🧪 Iniciando testes do sistema de cobrança...');
  
  try {
    // 1. Testar função get_billing_stats
    console.log('\n1️⃣ Testando get_billing_stats...');
    const { data: stats, error: statsError } = await supabase
      .rpc('get_billing_stats', { p_org_id: 'test-org-id' });
    
    if (statsError) {
      console.error('❌ Erro ao buscar estatísticas:', statsError);
    } else {
      console.log('✅ Estatísticas obtidas:', stats);
    }

    // 2. Testar endpoint de saldo
    console.log('\n2️⃣ Testando endpoint de saldo...');
    const balanceResponse = await fetch(`${BASE_URL}/api/billing/balance?org_id=test-org-id`);
    const balanceData = await balanceResponse.json();
    
    if (balanceResponse.ok) {
      console.log('✅ Saldo obtido:', balanceData);
    } else {
      console.error('❌ Erro ao obter saldo:', balanceData);
    }

    // 3. Testar adição de créditos
    console.log('\n3️⃣ Testando adição de créditos...');
    const addCreditsResponse = await fetch(`${BASE_URL}/api/billing/balance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'test-org-id',
        amount: 100,
        description: 'Teste de adição de créditos'
      })
    });
    
    const addCreditsData = await addCreditsResponse.json();
    
    if (addCreditsResponse.ok) {
      console.log('✅ Créditos adicionados:', addCreditsData);
    } else {
      console.error('❌ Erro ao adicionar créditos:', addCreditsData);
    }

    // 4. Criar mensagem de teste para cobrança
    console.log('\n4️⃣ Criando mensagem de teste...');
    
    // Primeiro, verificar se existe uma organização de teste
    const { data: testOrg, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();
    
    if (orgError || !testOrg) {
      console.log('⚠️ Nenhuma organização encontrada, criando uma de teste...');
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          name: 'Test Organization',
          slug: 'test-org-' + Date.now()
        })
        .select()
        .single();
      
      if (createOrgError) {
        console.error('❌ Erro ao criar organização de teste:', createOrgError);
        return;
      }
      testOrg = newOrg;
    }
    
    // Verificar se existe um device de teste
    const { data: testDevice, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('org_id', testOrg.id)
      .limit(1)
      .single();
    
    let deviceId = testDevice?.id;
    if (!testDevice) {
      console.log('⚠️ Nenhum device encontrado, criando um de teste...');
      const { data: newDevice, error: createDeviceError } = await supabase
        .from('devices')
        .insert({
          org_id: testOrg.id,
          name: 'Test Device',
          session_name: 'test-session-' + Date.now(),
          evolution_base_url: 'https://test.com',
          evolution_api_key: 'test-key',
          webhook_secret: 'test-secret'
        })
        .select()
        .single();
      
      if (createDeviceError) {
        console.error('❌ Erro ao criar device de teste:', createDeviceError);
        return;
      }
      deviceId = newDevice.id;
    }
    
    // Verificar se existe um chatbot de teste
    const { data: testChatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id')
      .eq('device_id', deviceId)
      .limit(1)
      .single();
    
    let chatbotId = testChatbot?.id;
    if (!testChatbot) {
      console.log('⚠️ Nenhum chatbot encontrado, criando um de teste...');
      const { data: newChatbot, error: createChatbotError } = await supabase
        .from('chatbots')
        .insert({
          org_id: testOrg.id,
          device_id: deviceId,
          name: 'Test Chatbot',
          system_prompt: 'Você é um assistente útil.',
          groq_model: 'llama-3.1-70b-versatile',
          temperature: 0.7,
          max_tokens: 1000,
          is_active: true
        })
        .select()
        .single();
      
      if (createChatbotError) {
        console.error('❌ Erro ao criar chatbot de teste:', createChatbotError);
        return;
      }
      chatbotId = newChatbot.id;
    }
    
    const { data: testMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        org_id: testOrg.id,
        device_id: deviceId,
        chatbot_id: chatbotId,
        direction: 'outbound',
        sender_phone: 'bot',
        receiver_phone: '+5521999999999',
        content: 'Esta é uma mensagem de teste para cobrança',
        phone_number: '+5521999999999',
        message_content: 'Esta é uma mensagem de teste para cobrança',
        status: 'sent',
        tokens_used: 50,
        billing_status: 'pending',
        metadata: {
          generated_by: 'ai',
          input_tokens: 35,
          output_tokens: 15
        }
      })
      .select()
      .single();
    
    if (messageError) {
      console.error('❌ Erro ao criar mensagem de teste:', messageError);
      return;
    }
    
    console.log('✅ Mensagem de teste criada:', testMessage.id);

    // 5. Testar processamento de cobrança
    console.log('\n5️⃣ Testando processamento de cobrança...');
    const processResponse = await fetch(`${BASE_URL}/api/billing/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message_id: testMessage.id,
        org_id: 'test-org-id'
      })
    });
    
    const processData = await processResponse.json();
    
    if (processResponse.ok) {
      console.log('✅ Cobrança processada:', processData);
    } else {
      console.error('❌ Erro ao processar cobrança:', processData);
    }

    // 6. Testar processamento de cobrança via SQL
    console.log('\n6️⃣ Testando processamento de cobrança via SQL...');
    try {
      const { data: billingResult, error: billingError } = await supabase
        .rpc('process_message_billing', {
          p_message_id: testMessage.id,
          p_org_id: testOrg.id,
          p_content: 'Esta é uma mensagem de teste para cobrança'
        });
      
      if (billingError) {
        console.error('❌ Erro no processamento de cobrança:', billingError);
      } else {
        console.log('✅ Processamento de cobrança executado com sucesso:', billingResult);
        
        // Verificar se o status da mensagem foi atualizado
        const { data: updatedMessage } = await supabase
          .from('messages')
          .select('billing_status, cost_credits, charged_at')
          .eq('id', testMessage.id)
          .single();
        
        console.log('📊 Status de cobrança da mensagem:', {
          billing_status: updatedMessage?.billing_status,
          cost_credits: updatedMessage?.cost_credits,
          charged_at: updatedMessage?.charged_at
        });
      }
    } catch (billingProcessError) {
      console.error('❌ Erro no processamento de cobrança:', billingProcessError.message);
    }

    // 7. Testar estatísticas após cobrança
    console.log('\n7️⃣ Verificando estatísticas atualizadas...');
    const { data: finalStats, error: finalStatsError } = await supabase
      .rpc('get_billing_stats', { p_org_id: 'test-org-id' });
    
    if (finalStatsError) {
      console.error('❌ Erro ao buscar estatísticas finais:', finalStatsError);
    } else {
      console.log('✅ Estatísticas finais:', finalStats);
    }

    // 8. Limpeza - remover dados de teste
    console.log('\n8️⃣ Limpando dados de teste...');
    await supabase
      .from('messages')
      .delete()
      .eq('id', testMessage.id);
    
    console.log('✅ Dados de teste removidos');
    
    console.log('\n🎉 Testes concluídos com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  }
}

// Executar testes
if (require.main === module) {
  (async () => {
    await testBillingSystem();
    process.exit(0);
  })();
}

module.exports = {
  testBillingSystem
};