const axios = require('axios');

async function testWebhook() {
  try {
    console.log('🧪 Testando webhook manualmente...\n');
    
    // Teste 1: Rota principal
    console.log('1️⃣ Testando rota principal /api/webhook/evolution');
    try {
      const response1 = await axios.post('http://localhost:3000/api/webhook/evolution', {
        event: 'connection.update',
        instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
        data: {
          state: 'open'
        }
      });
      console.log('✅ Rota principal OK:', response1.status);
    } catch (error) {
      console.log('❌ Erro na rota principal:', error.message);
    }
    
    // Teste 2: Subrota connection-update
    console.log('\n2️⃣ Testando subrota /api/webhook/evolution/connection-update');
    try {
      const response2 = await axios.post('http://localhost:3000/api/webhook/evolution/connection-update', {
        instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
        data: {
          state: 'open'
        }
      });
      console.log('✅ Subrota connection-update OK:', response2.status);
    } catch (error) {
      console.log('❌ Erro na subrota connection-update:', error.message);
    }
    
    // Teste 3: Subrota messages-upsert
    console.log('\n3️⃣ Testando subrota /api/webhook/evolution/messages-upsert');
    try {
      const response3 = await axios.post('http://localhost:3000/api/webhook/evolution/messages-upsert', {
        instance: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77',
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
            id: 'test123'
          },
          message: {
            conversation: 'Teste de mensagem'
          }
        }
      });
      console.log('✅ Subrota messages-upsert OK:', response3.status);
    } catch (error) {
      console.log('❌ Erro na subrota messages-upsert:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testWebhook();