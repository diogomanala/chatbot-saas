require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Função para calcular custo em créditos (1000 tokens = 1 crédito)
function calculateCreditCost(inputTokens, outputTokens) {
  const totalTokens = inputTokens + outputTokens;
  return Math.ceil(totalTokens / 1000); // Arredondar para cima
}

async function testMessageBilling() {
  try {
    console.log('🧪 [TESTE DE COBRANÇA DE MENSAGENS]\n');
    
    // IDs de teste (substitua pelos IDs reais do seu sistema)
    const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa'; // TitecWeb Admin
    const chatbotId = '761a8909-6674-440b-9811-7a232efb8a4b'; // Assistente TitecWeb
    const deviceId = '9d166619-e7cf-4f5e-9637-65c6f4d2481f';
    
    // Buscar uma organização e device para o teste
    const { data: device } = await supabase
      .from('devices')
      .select('*, organizations(id, name)')
      .limit(1)
      .single();
    
    if (!device) {
      console.log('❌ Nenhum device encontrado para teste');
      return;
    }
    
    console.log(`📱 Usando device: ${device.id}`);
    console.log(`🏢 Organização: ${device.organizations.name}\n`);
    
    // Verificar saldo atual
    const { data: wallet } = await supabase
      .from('credit_wallets')
      .select('balance')
      .eq('org_id', device.org_id)
      .single();
    
    const currentBalance = wallet?.balance || 0;
    console.log(`💰 Saldo atual: ${currentBalance} créditos\n`);
    
    // Simular diferentes cenários de mensagens
    const testScenarios = [
      {
        name: 'Mensagem Curta',
        content: 'Olá, como posso ajudar?',
        expectedTokens: 150
      },
      {
        name: 'Mensagem Média',
        content: 'Olá! Sou seu assistente virtual e estou aqui para ajudar com suas dúvidas. Posso fornecer informações sobre nossos produtos e serviços. Como posso ajudá-lo hoje?',
        expectedTokens: 400
      },
      {
        name: 'Mensagem Longa',
        content: 'Prezado cliente, agradecemos seu contato! Nossa empresa está comprometida em oferecer o melhor atendimento e soluções personalizadas para suas necessidades. Temos uma ampla gama de produtos e serviços que podem atender perfeitamente ao que você procura. Nossa equipe de especialistas está sempre disponível para esclarecer dúvidas e fornecer suporte técnico completo. Além disso, oferecemos garantia estendida e suporte pós-venda diferenciado. Gostaríamos de agendar uma reunião para apresentar nossas soluções em detalhes.',
        expectedTokens: 800
      }
    ];
    
    for (let i = 0; i < testScenarios.length; i++) {
      const scenario = testScenarios[i];
      console.log(`\n🎯 Testando: ${scenario.name}`);
      console.log(`📝 Conteúdo: ${scenario.content.substring(0, 50)}...`);
      
      // Criar mensagem de teste
      const { data: message, error: insertError } = await supabase
        .from('messages')
        .insert({
          org_id: orgId,
          chatbot_id: chatbotId,
          device_id: deviceId,
          phone_number: '+5522997603813',
          contact_name: 'Teste Usuario',
          message_content: scenario.content,
          direction: 'outbound',
          sender_phone: 'bot',
          receiver_phone: '5522997603813@s.whatsapp.net',
          content: scenario.content,
          status: 'sent',
          tokens_used: scenario.expectedTokens,
          billing_status: 'pending',
          metadata: {
            generated_by: 'test',
            test_scenario: scenario.name
          }
        })
        .select()
        .single();
      
      if (insertError) {
        console.log(`❌ Erro ao criar mensagem: ${insertError.message}`);
        continue;
      }
      
      console.log(`✅ Mensagem criada: ${message.id}`);
      console.log(`🔢 Tokens: ${message.tokens_used}`);
      
      // Calcular custo
      const costCredits = calculateCreditCost(message.tokens_used, 0);
      console.log(`💰 Custo calculado: ${costCredits} créditos`);
      
      // Verificar saldo antes do débito
      const { data: walletBefore } = await supabase
        .from('credit_wallets')
        .select('balance')
        .eq('org_id', orgId)
        .single();
      
      const balanceBefore = walletBefore?.balance || 0;
      console.log(`💳 Saldo antes: ${balanceBefore} créditos`);
      
      if (balanceBefore < costCredits) {
        console.log(`⚠️  Saldo insuficiente para este teste`);
        
        // Marcar como failed
        await supabase
          .from('messages')
          .update({
            billing_status: 'failed',
            cost_credits: costCredits,
            charged_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        console.log(`❌ Mensagem marcada como 'failed'`);
        continue;
      }
      
      // Processar débito
      const { error: debitError } = await supabase
        .from('credit_wallets')
        .update({ 
          balance: balanceBefore - costCredits,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId);
      
      if (debitError) {
        console.log(`❌ Erro ao debitar: ${debitError.message}`);
        continue;
      }
      
      // Marcar mensagem como charged
      await supabase
        .from('messages')
        .update({
          billing_status: 'charged',
          cost_credits: costCredits,
          charged_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      // Registrar transação
      await supabase
        .from('transactions')
        .insert({
          org_id: orgId,
          type: 'debit',
          amount: costCredits,
          description: `Teste: ${scenario.name} - Mensagem ${message.id}`,
          metadata: {
            message_id: message.id,
            tokens_used: message.tokens_used,
            test_scenario: scenario.name
          }
        });
      
      // Verificar saldo após débito
      const { data: walletAfter } = await supabase
        .from('credit_wallets')
        .select('balance')
        .eq('org_id', device.org_id)
        .single();
      
      console.log(`💳 Saldo depois: ${walletAfter.balance} créditos`);
      console.log(`✅ Débito realizado com sucesso!`);
      
      // Aguardar um pouco entre os testes
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 [RESUMO DOS TESTES]');
    
    // Buscar mensagens de teste criadas
    const { data: testMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('org_id', device.org_id)
      .contains('metadata', { generated_by: 'test' })
      .order('created_at', { ascending: false });
    
    console.log(`✅ Mensagens de teste criadas: ${testMessages?.length || 0}`);
    
    let totalCharged = 0;
    let totalFailed = 0;
    
    testMessages?.forEach(msg => {
      if (msg.billing_status === 'charged') {
        totalCharged += msg.cost_credits || 0;
      } else if (msg.billing_status === 'failed') {
        totalFailed++;
      }
    });
    
    console.log(`💰 Total debitado: ${totalCharged} créditos`);
    console.log(`❌ Mensagens falharam: ${totalFailed}`);
    
    // Verificar saldo final
    const { data: finalWallet } = await supabase
      .from('credit_wallets')
      .select('balance')
      .eq('org_id', device.org_id)
      .single();
    
    console.log(`💳 Saldo final: ${finalWallet?.balance || 0} créditos`);
    console.log('🎉 Teste concluído!\n');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testMessageBilling();