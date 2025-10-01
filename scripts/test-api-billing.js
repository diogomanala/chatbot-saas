require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuração do Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuração da API
const API_BASE_URL = 'http://localhost:3000';

async function testApiBilling() {
  console.log('🧪 [TESTE DE COBRANÇA VIA API]\n');

  try {
    // 1. Buscar um device válido
    const { data: devices, error: deviceError } = await supabase
      .from('devices')
      .select('id, org_id')
      .limit(1);
    
    if (deviceError) {
      console.log('❌ Erro ao buscar devices:', deviceError.message);
      return;
    }
    
    const device = devices?.[0];

    if (!device) {
      console.log('❌ Nenhum device encontrado');
      return;
    }

    console.log(`📱 Usando device: ${device.id}`);
    console.log(`🏢 Org ID: ${device.org_id}`);

    // 2. Verificar saldo inicial
    const { data: walletBefore } = await supabase
      .from('credit_wallets')
      .select('balance')
      .eq('org_id', device.org_id)
      .single();

    const balanceBefore = walletBefore?.balance || 0;
    console.log(`💰 Saldo inicial: ${balanceBefore} créditos\n`);

    // 3. Enviar mensagem via API
    const testMessage = {
      content: 'Esta é uma mensagem de teste para verificar a cobrança automática do sistema.',
      device_id: device.id
    };

    console.log('📤 Enviando mensagem via API...');
    console.log(`📝 Conteúdo: ${testMessage.content}`);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/messages/send`, testMessage, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('✅ Resposta da API:', response.status);
      console.log('📋 Dados:', response.data);

    } catch (apiError) {
      if (apiError.response) {
        console.log('❌ Erro da API:', apiError.response.status);
        console.log('📋 Detalhes:', apiError.response.data);
      } else {
        console.log('❌ Erro de conexão:', apiError.message);
      }
    }

    // 4. Aguardar processamento
    console.log('\n⏳ Aguardando processamento...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Verificar saldo final
    const { data: walletAfter } = await supabase
      .from('credit_wallets')
      .select('balance')
      .eq('org_id', device.org_id)
      .single();

    const balanceAfter = walletAfter?.balance || 0;
    const debitedAmount = balanceBefore - balanceAfter;

    console.log('\n📊 [RESULTADO DO TESTE]');
    console.log(`💰 Saldo antes: ${balanceBefore} créditos`);
    console.log(`💰 Saldo depois: ${balanceAfter} créditos`);
    console.log(`💸 Valor debitado: ${debitedAmount} créditos`);

    if (debitedAmount > 0) {
      console.log('✅ Cobrança funcionando corretamente!');
    } else {
      console.log('⚠️  Nenhum débito detectado - verificar logs');
    }

    // 6. Verificar mensagens criadas recentemente
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('id, tokens, billing_status, cost_credits, created_at')
      .eq('device_id', device.id)
      .order('created_at', { ascending: false })
      .limit(3);

    console.log('\n📨 Mensagens recentes:');
    recentMessages?.forEach((msg, index) => {
      console.log(`${index + 1}. ID: ${msg.id}`);
      console.log(`   Tokens: ${msg.tokens || 'N/A'}`);
      console.log(`   Status: ${msg.billing_status || 'N/A'}`);
      console.log(`   Custo: ${msg.cost_credits || 'N/A'} créditos`);
      console.log(`   Criada: ${new Date(msg.created_at).toLocaleString()}\n`);
    });

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }

  console.log('🎉 Teste concluído!');
}

// Executar teste
testApiBilling().catch(console.error);