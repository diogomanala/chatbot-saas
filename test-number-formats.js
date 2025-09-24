require('dotenv').config({ path: '.env.local' });

const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

async function testNumberFormats() {
  console.log('🧪 Testando diferentes formatos do número 5522997603813...');
  console.log(`🏢 Instância: ${EVOLUTION_INSTANCE}`);
  console.log('');

  // Diferentes formatos para testar
  const numberFormats = [
    '5522997603813',           // Formato original
    '55 22 99760-3813',        // Com espaços e hífen
    '+5522997603813',          // Com código do país
    '22997603813',             // Sem código do país
    '5522997603813@s.whatsapp.net', // Formato WhatsApp
    '5522997603813@c.us'       // Formato alternativo
  ];

  for (const number of numberFormats) {
    console.log(`📱 Testando formato: ${number}`);
    
    try {
      const messageData = {
        number: number,
        text: `Teste formato ${number} - ${new Date().toLocaleTimeString()}`
      };

      const response = await fetch(`${EVOLUTION_BASE_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ Sucesso - ID: ${result.key?.id}, Status: ${result.status}`);
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Erro ${response.status}: ${errorText}`);
      }

    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }

    // Aguardar 2 segundos entre tentativas
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n🔍 Verificando contatos existentes na instância...');
  
  try {
    const contactsResponse = await fetch(`${EVOLUTION_BASE_URL}/chat/findContacts/${EVOLUTION_INSTANCE}`, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (contactsResponse.ok) {
      const contacts = await contactsResponse.json();
      console.log(`📋 Total de contatos: ${contacts.length}`);
      
      // Procurar por contatos que contenham o número
      const matchingContacts = contacts.filter(contact => 
        contact.id?.includes('5522997603813') || 
        contact.pushName?.includes('5522997603813') ||
        contact.name?.includes('5522997603813')
      );

      if (matchingContacts.length > 0) {
        console.log('✅ Contatos encontrados:');
        matchingContacts.forEach(contact => {
          console.log(`   - ID: ${contact.id}`);
          console.log(`   - Nome: ${contact.pushName || contact.name || 'N/A'}`);
        });
      } else {
        console.log('❌ Nenhum contato encontrado com esse número');
      }
    } else {
      console.log(`❌ Erro ao buscar contatos: ${contactsResponse.status}`);
    }

  } catch (error) {
    console.log(`❌ Erro ao verificar contatos: ${error.message}`);
  }
}

testNumberFormats();