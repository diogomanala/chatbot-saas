require('dotenv').config();

async function testSecondNumber() {
  const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
  const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`;
  const phoneNumber = '5522997603813@s.whatsapp.net';
  
  console.log('Testando Evolution API com segundo número...');
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
        text: 'Teste de conexão - segundo número'
      })
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    console.log('Response OK?', response.ok);
    
    if (response.ok) {
      console.log('✅ Evolution API funcionando com este número!');
    } else {
      console.log('❌ Evolution API falhou com este número também');
    }
    
  } catch (error) {
    console.error('Erro ao testar Evolution API:', error.message);
  }
}

testSecondNumber();