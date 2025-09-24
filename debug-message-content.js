require('dotenv').config({ path: '.env.local' });

const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const TARGET_NUMBER = '5522997603813';

async function debugMessageContent() {
  console.log('🔍 Investigando problema de conteúdo null nas mensagens...');
  console.log(`📱 Número alvo: ${TARGET_NUMBER}`);
  console.log('');

  try {
    // 1. Enviar mensagem de teste com conteúdo específico
    const testMessage = `TESTE DEBUG - ${new Date().toLocaleTimeString()} - Esta mensagem deve ter conteúdo!`;
    
    console.log('📤 1. Enviando mensagem de teste...');
    console.log(`   Conteúdo: "${testMessage}"`);
    
    const response = await fetch(`${EVOLUTION_BASE_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: TARGET_NUMBER,
        text: testMessage
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Mensagem enviada com sucesso!');
      console.log(`   ID: ${result.key?.id}`);
      console.log(`   Status: ${result.status}`);
      console.log('');
    } else {
      console.error('❌ Erro ao enviar mensagem:', response.status);
      return;
    }

    // 2. Aguardar processamento
    console.log('⏳ 2. Aguardando 8 segundos para processamento...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // 3. Verificar no banco de dados
    console.log('🔍 3. Verificando mensagens no banco de dados...');
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    const query = `
      SELECT 
        id,
        direction,
        phone_number,
        message_content,
        content,
        created_at,
        metadata
      FROM messages 
      WHERE phone_number LIKE '%${TARGET_NUMBER}%'
      ORDER BY created_at DESC 
      LIMIT 5
    `;

    const dbResult = await pool.query(query);
    
    console.log(`📊 Encontradas ${dbResult.rows.length} mensagens recentes:`);
    console.log('');
    
    dbResult.rows.forEach((row, index) => {
      console.log(`--- Mensagem ${index + 1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`Direção: ${row.direction}`);
      console.log(`Telefone: ${row.phone_number}`);
      console.log(`message_content: ${row.message_content === null ? 'NULL' : `"${row.message_content}"`}`);
      console.log(`content: ${row.content === null ? 'NULL' : `"${row.content}"`}`);
      console.log(`Criado em: ${row.created_at}`);
      
      if (row.metadata) {
        console.log(`Metadata keys: ${Object.keys(row.metadata).join(', ')}`);
        if (row.metadata.originalPayload) {
          console.log(`Original payload existe: SIM`);
          const payload = row.metadata.originalPayload;
          if (payload.data && payload.data.message) {
            console.log(`Payload message keys: ${Object.keys(payload.data.message).join(', ')}`);
            console.log(`Conversation: ${payload.data.message.conversation || 'UNDEFINED'}`);
            console.log(`ExtendedTextMessage: ${payload.data.message.extendedTextMessage ? 'EXISTS' : 'UNDEFINED'}`);
          }
        }
      }
      console.log('');
    });

    await pool.end();

    // 4. Simular webhook payload para debug
    console.log('🧪 4. Simulando processamento de webhook...');
    
    const webhookPayload = {
      event: 'messages.upsert',
      instance: EVOLUTION_INSTANCE,
      data: {
        key: {
          id: `DEBUG_${Date.now()}`,
          remoteJid: `${TARGET_NUMBER}@s.whatsapp.net`,
          fromMe: false
        },
        message: {
          conversation: testMessage
        },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    };

    console.log('📋 Payload simulado:');
    console.log(JSON.stringify(webhookPayload, null, 2));
    
    // Testar extração de conteúdo como no webhook
    const messageData = webhookPayload.data;
    const messageText = messageData.message?.conversation || 
                       messageData.message?.extendedTextMessage?.text;
    
    console.log('');
    console.log('🔍 Teste de extração de conteúdo:');
    console.log(`   conversation: ${messageData.message?.conversation || 'UNDEFINED'}`);
    console.log(`   extendedTextMessage.text: ${messageData.message?.extendedTextMessage?.text || 'UNDEFINED'}`);
    console.log(`   Resultado final: ${messageText || 'NULL'}`);

  } catch (error) {
    console.error('❌ Erro durante debug:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

debugMessageContent();