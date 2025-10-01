require('dotenv').config({ path: '.env.local' });

const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const TARGET_NUMBER = '5522997603813';

async function testWebhookMessage() {
  console.log('🧪 Testando webhook enviando mensagem...');
  console.log(`📱 Para: ${TARGET_NUMBER}`);
  console.log(`🏢 Instância: ${EVOLUTION_INSTANCE}`);
  console.log('');

  try {
    const messageData = {
      number: TARGET_NUMBER,
      text: `Teste webhook - ${new Date().toLocaleTimeString()} - Se você receber esta mensagem, o webhook deve estar funcionando!`
    };

    console.log('📤 Enviando mensagem de teste...');
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
      console.log('✅ Mensagem enviada com sucesso!');
      console.log(`📋 ID da mensagem: ${result.key?.id}`);
      console.log(`📊 Status: ${result.status}`);
      console.log(`⏰ Timestamp: ${result.messageTimestamp}`);
      
      console.log('\n⏳ Aguardando 5 segundos para verificar se chegou no banco...');
      
      // Aguardar 5 segundos
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verificar no banco de dados
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });

      const query = `
        SELECT 
          id, content, direction, phone_number, created_at,
          device_id, chatbot_id
        FROM messages 
        WHERE phone_number = $1 
        ORDER BY created_at DESC 
        LIMIT 3
      `;

      const dbResult = await pool.query(query, [TARGET_NUMBER]);
      
      console.log('\n📊 Últimas mensagens no banco de dados:');
      if (dbResult.rows.length > 0) {
        dbResult.rows.forEach((msg, index) => {
          console.log(`   ${index + 1}. [${msg.direction}] ${msg.content || 'null'} - ${msg.created_at}`);
        });
      } else {
        console.log('   ❌ Nenhuma mensagem encontrada no banco');
      }

      await pool.end();

    } else {
      const errorText = await response.text();
      console.log(`❌ Erro ao enviar mensagem: ${response.status}`);
      console.log(`📋 Erro: ${errorText}`);
    }

  } catch (error) {
    console.error('❌ Erro durante teste:', error.message);
    console.error('📋 Stack trace:', error.stack);
  }
}

testWebhookMessage();