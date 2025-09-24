require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSimpleBilling() {
  try {
    console.log('=== TESTE DO SISTEMA DE COBRANÇA SIMPLIFICADO ===\n');

    // 1. Verificar mensagens pendentes
    console.log('1. Verificando mensagens pendentes...');
    const { data: pendingMessages, error: pendingError } = await supabase
      .from('messages')
      .select('id, org_id, content, direction, billing_status, created_at')
      .or('billing_status.is.null,billing_status.eq.pending')
      .not('org_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(10);

    if (pendingError) {
      console.error('Erro ao buscar mensagens pendentes:', pendingError);
      return;
    }

    console.log(`Encontradas ${pendingMessages?.length || 0} mensagens pendentes`);
    
    if (pendingMessages && pendingMessages.length > 0) {
      console.log('\nPrimeiras mensagens pendentes:');
      pendingMessages.forEach((msg, index) => {
        console.log(`${index + 1}. Org: ${msg.org_id}, Direção: ${msg.direction}, Status: ${msg.billing_status || 'null'}, Conteúdo: "${(msg.content || '').substring(0, 50)}..."`);
      });

      // 2. Verificar saldos das organizações
      const orgIds = [...new Set(pendingMessages.map(m => m.org_id))];
      console.log(`\n2. Verificando saldos de ${orgIds.length} organizações...`);
      
      for (const orgId of orgIds) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', orgId)
          .single();

        if (orgError) {
          console.log(`Erro ao buscar organização ${orgId}:`, orgError.message);
        } else {
          const { data: walletData, error: walletError } = await supabase
             .from('credit_wallets')
             .select('balance')
             .eq('org_id', `${orgId}::uuid`)
             .single();

          const balance = walletError ? 0 : (walletData?.balance || 0);
          const orgMessages = pendingMessages.filter(m => m.org_id === orgId);
          console.log(`Org: ${orgData.name || orgId} - Saldo: ${balance} créditos - ${orgMessages.length} mensagens pendentes`);
        }
      }

      // 3. Testar processamento para primeira organização
      const firstOrgId = orgIds[0];
      console.log(`\n3. Testando processamento para organização: ${firstOrgId}`);
      
      try {
        const response = await fetch('http://localhost:3000/api/billing/simple-process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ org_id: firstOrgId })
        });

        const result = await response.json();
        console.log('Resultado do processamento:', JSON.stringify(result, null, 2));

        if (result.success) {
          console.log(`\n✅ Sucesso! Processadas ${result.processed} mensagens`);
          console.log(`💰 Créditos debitados: ${result.totalCredits}`);
          console.log(`📊 Saldo anterior: ${result.previousBalance}`);
          console.log(`📊 Novo saldo: ${result.newBalance}`);
        } else {
          console.log('❌ Erro no processamento:', result.error);
        }
      } catch (fetchError) {
        console.error('Erro ao chamar API:', fetchError.message);
      }

    } else {
      console.log('\n✅ Nenhuma mensagem pendente encontrada!');
      
      // Criar algumas mensagens de teste
      console.log('\n4. Criando mensagens de teste...');
      
      // Usar organização que tem chatbots (baseado na lista anterior)
      const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
      const { data: firstOrg, error: firstOrgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .single();

      if (firstOrgError) {
        console.error('Erro ao buscar organização:', firstOrgError);
        return;
      }

      console.log(`Usando organização: ${firstOrg.name} (${firstOrg.id})`);

      // Buscar um chatbot e device para usar nos testes
      const { data: chatbotData, error: chatbotError } = await supabase
        .from('chatbots')
        .select('id')
        .eq('org_id', firstOrg.id)
        .limit(1)
        .single();

      if (chatbotError) {
        console.error('Erro ao buscar chatbot:', chatbotError);
        return;
      }

      const { data: deviceData, error: deviceError } = await supabase
        .from('devices')
        .select('id')
        .eq('org_id', firstOrg.id)
        .limit(1)
        .single();

      if (deviceError) {
        console.error('Erro ao buscar device:', deviceError);
        return;
      }

      console.log(`Usando chatbot: ${chatbotData.id} e device: ${deviceData.id}`);

      // Criar mensagens de teste
      const testMessages = [
        {
          org_id: firstOrg.id,
          chatbot_id: chatbotData.id,
          device_id: deviceData.id,
          direction: 'inbound',
          sender_phone: '5511999999999',
          receiver_phone: 'bot',
          phone_number: '5511999999999',
          message_content: 'Olá, preciso de ajuda com meu pedido',
          status: 'received',
          billing_status: null,
          tokens_used: 0,
          external_id: 'test_msg_1_' + Date.now()
        },
        {
          org_id: firstOrg.id,
          chatbot_id: chatbotData.id,
          device_id: deviceData.id,
          direction: 'outbound',
          sender_phone: 'bot',
          receiver_phone: '5511999999999',
          phone_number: '5511999999999',
          message_content: 'Olá! Como posso ajudá-lo hoje? Esta é uma resposta do chatbot que deve ser cobrada.',
          status: 'sent',
          billing_status: null,
          tokens_used: 0,
          external_id: 'test_msg_2_' + Date.now()
        }
      ];

      const { data: createdMessages, error: createError } = await supabase
        .from('messages')
        .insert(testMessages)
        .select();

      if (createError) {
        console.error('Erro ao criar mensagens de teste:', createError);
        return;
      }

      console.log(`✅ Criadas ${createdMessages.length} mensagens de teste`);
      
      // Testar processamento
      console.log('\n5. Testando processamento das mensagens criadas...');
      
      try {
        const response = await fetch('http://localhost:3000/api/billing/simple-process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ org_id: firstOrg.id })
        });

        const result = await response.json();
        console.log('Resultado do processamento:', JSON.stringify(result, null, 2));

        if (result.success) {
          console.log(`\n✅ Sucesso! Processadas ${result.processed} mensagens`);
          console.log(`💰 Créditos debitados: ${result.totalCredits}`);
          console.log(`📊 Saldo anterior: ${result.previousBalance}`);
          console.log(`📊 Novo saldo: ${result.newBalance}`);
        } else {
          console.log('❌ Erro no processamento:', result.error);
        }
      } catch (fetchError) {
        console.error('Erro ao chamar API:', fetchError.message);
      }
    }

    console.log('\n=== TESTE CONCLUÍDO ===');

  } catch (error) {
    console.error('Erro no teste:', error);
  }
}

// Executar teste
testSimpleBilling();