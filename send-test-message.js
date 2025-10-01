require('dotenv').config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';

async function sendTestMessage() {
  console.log('📤 Enviando nova mensagem de teste...');
  
  try {
    const testMessage = `TESTE FINAL - ${new Date().toLocaleTimeString()} - Campo content deve estar preenchido agora!`;
    const testNumber = '5522997603813';
    
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
    console.log(`   Conteúdo: "${testMessage}"`);
    console.log('\n⏳ Aguarde alguns segundos e execute o script de verificação novamente...');

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
  }
}

sendTestMessage();