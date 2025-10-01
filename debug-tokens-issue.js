const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTokensIssue() {
  console.log('🔍 INVESTIGANDO PROBLEMA DOS TOKENS = 0\n');

  try {
    // 1. Verificar mensagens recentes com tokens = 0
    console.log('1️⃣ Verificando mensagens com tokens = 0...');
    const { data: zeroTokenMessages, error: zeroError } = await supabase
      .from('messages')
      .select('*')
      .eq('tokens_used', 0)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(3);

    if (zeroError) {
      console.error('❌ Erro ao buscar mensagens:', zeroError);
      return;
    }

    console.log(`📊 Encontradas ${zeroTokenMessages?.length || 0} mensagens outbound com tokens = 0`);
    
    if (zeroTokenMessages && zeroTokenMessages.length > 0) {
      zeroTokenMessages.forEach((msg, index) => {
        console.log(`\n📝 Mensagem ${index + 1}:`);
        console.log(`   ID: ${msg.id}`);
        console.log(`   Conteúdo: ${msg.message_content?.substring(0, 50)}...`);
        console.log(`   Tokens: ${msg.tokens_used}`);
        console.log(`   Cost Credits: ${msg.cost_credits}`);
        console.log(`   Billing Status: ${msg.billing_status}`);
        console.log(`   Charged At: ${msg.charged_at}`);
        console.log(`   Created At: ${msg.created_at}`);
        console.log(`   Metadata: ${JSON.stringify(msg.metadata, null, 2)}`);
      });
    }

    // 2. Verificar se existem mensagens com tokens > 0
    console.log('\n2️⃣ Verificando mensagens com tokens > 0...');
    const { data: nonZeroTokenMessages, error: nonZeroError } = await supabase
      .from('messages')
      .select('*')
      .gt('tokens_used', 0)
      .order('created_at', { ascending: false })
      .limit(3);

    if (nonZeroError) {
      console.error('❌ Erro ao buscar mensagens com tokens > 0:', nonZeroError);
    } else {
      console.log(`📊 Encontradas ${nonZeroTokenMessages?.length || 0} mensagens com tokens > 0`);
      
      if (nonZeroTokenMessages && nonZeroTokenMessages.length > 0) {
        nonZeroTokenMessages.forEach((msg, index) => {
          console.log(`\n✅ Mensagem ${index + 1} com tokens:`);
          console.log(`   ID: ${msg.id}`);
          console.log(`   Tokens: ${msg.tokens_used}`);
          console.log(`   Cost Credits: ${msg.cost_credits}`);
          console.log(`   Direction: ${msg.direction}`);
          console.log(`   Billing Status: ${msg.billing_status}`);
        });
      }
    }

    // 3. Testar inserção manual de mensagem com tokens
    console.log('\n3️⃣ Testando inserção manual com tokens...');
    
    // Buscar device e chatbot válidos
    const { data: device } = await supabase
      .from('devices')
      .select('id, org_id, chatbot_id')
      .limit(1)
      .single();

    if (!device) {
      console.log('❌ Nenhum device encontrado para teste');
      return;
    }

    const testMessage = {
      org_id: device.org_id,
      chatbot_id: device.chatbot_id,
      device_id: device.id,
      phone_number: '5511999999999',
      message_content: 'Teste manual de tokens',
      direction: 'outbound',
      sender_phone: device.id,
      receiver_phone: '5511999999999',
      content: 'Teste manual de tokens',
      status: 'sent',
      external_id: 'manual-test-' + Date.now(),
      tokens_used: 150, // DEFININDO TOKENS MANUALMENTE
      cost_credits: 0.15,
      billing_status: 'pending'
    };

    console.log('📝 Inserindo mensagem de teste com tokens = 150...');
    const { data: insertedMessage, error: insertError } = await supabase
      .from('messages')
      .insert(testMessage)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao inserir mensagem de teste:', insertError);
    } else {
      console.log('✅ Mensagem de teste inserida com sucesso!');
      console.log(`   ID: ${insertedMessage.id}`);
      console.log(`   Tokens inseridos: ${insertedMessage.tokens_used}`);
      console.log(`   Cost Credits: ${insertedMessage.cost_credits}`);
    }

    // 4. Verificar se o problema está no AutoDebitService
    console.log('\n4️⃣ Verificando se o problema está no cálculo de tokens...');
    
    // Simular cálculo de tokens como no código
    const testContent = "Esta é uma mensagem de teste para calcular tokens";
    const estimatedTokens = Math.max(Math.ceil(testContent.length / 4), 50);
    
    console.log(`📊 Simulação de cálculo de tokens:`);
    console.log(`   Conteúdo: "${testContent}"`);
    console.log(`   Tamanho: ${testContent.length} caracteres`);
    console.log(`   Tokens estimados: ${estimatedTokens}`);
    console.log(`   Fórmula: Math.max(Math.ceil(${testContent.length} / 4), 50) = ${estimatedTokens}`);

  } catch (error) {
    console.error('❌ Erro durante investigação:', error);
  }
}

debugTokensIssue();