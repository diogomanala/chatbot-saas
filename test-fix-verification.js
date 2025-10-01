require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';

async function testFixVerification() {
  console.log('🔧 Testando correção do campo content...');
  
  try {
    // 1. Enviar mensagem de teste
    const testMessage = `TESTE CORREÇÃO - ${new Date().toLocaleTimeString()} - Verificando se campo content está sendo preenchido`;
    const testNumber = '5522997603813';
    
    console.log(`📤 Enviando mensagem de teste para ${testNumber}...`);
    
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: testNumber,
        text: testMessage
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Erro ao enviar mensagem: ${JSON.stringify(result)}`);
    }

    console.log('✅ Mensagem enviada com sucesso!');
    console.log(`   ID: ${result.key?.id}`);
    console.log(`   Status: ${result.status}`);

    // 2. Aguardar processamento
    console.log('\n⏳ Aguardando 10 segundos para processamento...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 3. Verificar mensagens no banco
    console.log('\n🔍 Verificando mensagens no banco de dados...');
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, direction, message_content, content, created_at')
      .eq('phone_number', `${testNumber}@s.whatsapp.net`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      throw error;
    }

    console.log('\n📊 Últimas 5 mensagens:');
    messages.forEach((msg, index) => {
      console.log(`\n${index + 1}. ${msg.direction.toUpperCase()} - ${msg.created_at}`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   message_content: "${msg.message_content}"`);
      console.log(`   content: "${msg.content}"`);
      console.log(`   ✅ Campo content preenchido: ${msg.content !== null ? 'SIM' : 'NÃO'}`);
    });

    // 4. Verificar se a correção funcionou
    const outboundMessages = messages.filter(m => m.direction === 'outbound');
    const fixedMessages = outboundMessages.filter(m => m.content !== null);
    
    console.log(`\n🎯 RESULTADO DA CORREÇÃO:`);
    console.log(`   Mensagens outbound encontradas: ${outboundMessages.length}`);
    console.log(`   Mensagens com campo content preenchido: ${fixedMessages.length}`);
    console.log(`   Taxa de sucesso: ${outboundMessages.length > 0 ? Math.round((fixedMessages.length / outboundMessages.length) * 100) : 0}%`);
    
    if (fixedMessages.length > 0) {
      console.log('\n✅ CORREÇÃO FUNCIONOU! Campo content está sendo preenchido para mensagens outbound.');
    } else {
      console.log('\n❌ CORREÇÃO NÃO FUNCIONOU. Campo content ainda está null para mensagens outbound.');
    }

  } catch (error) {
    console.error('❌ Erro durante teste:', error);
    console.error('Stack trace:', error.stack);
  }
}

testFixVerification();