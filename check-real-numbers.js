require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRealNumbers() {
  console.log('Verificando números reais no sistema...');
  
  const { data, error } = await supabase
    .from('messages')
    .select('phone_number')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Erro:', error);
    return;
  }
  
  console.log('Números reais encontrados:');
  data.forEach((msg, i) => {
    console.log(`${i+1}. ${msg.phone_number}`);
  });
  
  // Pegar um número real para teste
  if (data.length > 0) {
    const realNumber = data[0].phone_number;
    console.log(`\nUsando número real para teste: ${realNumber}`);
    
    // Testar Evolution API com número real
    await testWithRealNumber(realNumber);
  }
}

async function testWithRealNumber(phoneNumber) {
  const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
  const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`;
  
  console.log('\nTestando Evolution API com número real...');
  console.log('URL:', url);
  console.log('Número:', phoneNumber);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: 'Teste de conexão com número real'
      })
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    console.log('Response OK?', response.ok);
    
  } catch (error) {
    console.error('Erro ao testar Evolution API:', error.message);
  }
}

checkRealNumbers();