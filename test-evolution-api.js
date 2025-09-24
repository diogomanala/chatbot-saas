require('dotenv').config();

async function testEvolutionAPI() {
  const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
  const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`;
  
  console.log('Testando Evolution API...');
  console.log('URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: '5511999999999@s.whatsapp.net',
        text: 'Teste de conexão'
      })
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    console.log('Response OK?', response.ok);
    
  } catch (error) {
    console.error('Erro ao testar Evolution API:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testEvolutionAPI();