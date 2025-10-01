require('dotenv').config({ path: '.env.local' });

const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL; // Corrigido: era EVOLUTION_BASE_URL
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const TARGET_NUMBER = '5522997603813';

async function debugSpecificNumber() {
  console.log('🔍 Investigando problema com número específico...');
  console.log(`📱 Número alvo: ${TARGET_NUMBER}`);
  console.log(`🏢 Instância: ${EVOLUTION_INSTANCE}`);
  console.log('');

  try {
    // 1. Verificar status da instância
    console.log('1️⃣ Verificando status da instância...');
    const instanceResponse = await fetch(`${EVOLUTION_BASE_URL}/instance/fetchInstances`, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (instanceResponse.ok) {
      const instances = await instanceResponse.json();
      const targetInstance = instances.find(inst => 
        inst.instanceName === EVOLUTION_INSTANCE || 
        inst.instance?.instanceName === EVOLUTION_INSTANCE
      );
      
      if (targetInstance) {
        console.log(`✅ Instância encontrada: ${targetInstance.instanceName || targetInstance.instance?.instanceName}`);
        console.log(`📊 Status: ${targetInstance.connectionStatus || targetInstance.instance?.connectionStatus}`);
        console.log(`📞 Número: ${targetInstance.phoneNumber || targetInstance.instance?.phoneNumber || 'N/A'}`);
      } else {
        console.log('❌ Instância não encontrada!');
      }
    }

    // 2. Verificar configuração do webhook
    console.log('\n2️⃣ Verificando configuração do webhook...');
    const webhookResponse = await fetch(`${EVOLUTION_BASE_URL}/webhook/find/${EVOLUTION_INSTANCE}`, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (webhookResponse.ok) {
      const webhookConfig = await webhookResponse.json();
      console.log('✅ Configuração do webhook:');
      console.log(`   URL: ${webhookConfig.webhook?.url || 'N/A'}`);
      console.log(`   Habilitado: ${webhookConfig.webhook?.enabled || 'N/A'}`);
      console.log(`   Eventos: ${JSON.stringify(webhookConfig.webhook?.events || [])}`);
    } else {
      console.log(`❌ Erro ao buscar webhook: ${webhookResponse.status}`);
    }

    // 3. Tentar buscar contatos/chats
    console.log('\n3️⃣ Verificando contatos/chats...');
    const contactsResponse = await fetch(`${EVOLUTION_BASE_URL}/chat/findContacts/${EVOLUTION_INSTANCE}`, {
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (contactsResponse.ok) {
      const contacts = await contactsResponse.json();
      console.log(`📋 Total de contatos: ${contacts.length || 0}`);
      
      // Procurar pelo número específico
      const targetContact = contacts.find(contact => 
        contact.id?.includes(TARGET_NUMBER) || 
        contact.pushName?.includes(TARGET_NUMBER) ||
        contact.remoteJid?.includes(TARGET_NUMBER)
      );
      
      if (targetContact) {
        console.log(`✅ Contato encontrado: ${JSON.stringify(targetContact, null, 2)}`);
      } else {
        console.log(`❌ Contato ${TARGET_NUMBER} não encontrado na lista`);
        console.log('📝 Primeiros 3 contatos para referência:');
        contacts.slice(0, 3).forEach((contact, index) => {
          console.log(`   ${index + 1}. ID: ${contact.id}, Nome: ${contact.pushName || 'N/A'}`);
        });
      }
    } else {
      console.log(`❌ Erro ao buscar contatos: ${contactsResponse.status}`);
    }

    // 4. Verificar mensagens recentes da instância
    console.log('\n4️⃣ Verificando mensagens recentes da Evolution API...');
    const messagesResponse = await fetch(`${EVOLUTION_BASE_URL}/chat/findMessages/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        where: {
          fromMe: false
        },
        limit: 10
      })
    });

    if (messagesResponse.ok) {
      const messages = await messagesResponse.json();
      console.log(`📨 Mensagens recentes encontradas: ${messages.length || 0}`);
      
      if (messages && messages.length > 0) {
        console.log('📋 Últimas mensagens:');
        messages.slice(0, 5).forEach((msg, index) => {
          const from = msg.key?.remoteJid || msg.remoteJid || 'N/A';
          const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'N/A';
          const timestamp = new Date(msg.messageTimestamp * 1000).toLocaleString('pt-BR');
          console.log(`   ${index + 1}. De: ${from} | "${content}" | ${timestamp}`);
        });

        // Procurar mensagens do número específico
        const targetMessages = messages.filter(msg => {
          const from = msg.key?.remoteJid || msg.remoteJid || '';
          return from.includes(TARGET_NUMBER);
        });

        if (targetMessages.length > 0) {
          console.log(`\n✅ Encontradas ${targetMessages.length} mensagens do número ${TARGET_NUMBER}:`);
          targetMessages.forEach((msg, index) => {
            const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'N/A';
            const timestamp = new Date(msg.messageTimestamp * 1000).toLocaleString('pt-BR');
            console.log(`   ${index + 1}. "${content}" | ${timestamp}`);
          });
        } else {
          console.log(`❌ Nenhuma mensagem encontrada do número ${TARGET_NUMBER}`);
        }
      }
    } else {
      console.log(`❌ Erro ao buscar mensagens: ${messagesResponse.status}`);
    }

    // 5. Testar envio de mensagem para o número
    console.log('\n5️⃣ Testando envio de mensagem para o número...');
    const sendResponse = await fetch(`${EVOLUTION_BASE_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: TARGET_NUMBER,
        text: "Teste de conectividade - se você receber esta mensagem, a instância está funcionando!"
      })
    });

    if (sendResponse.ok) {
      const sendResult = await sendResponse.json();
      console.log('✅ Mensagem de teste enviada com sucesso!');
      console.log(`📋 Resultado: ${JSON.stringify(sendResult, null, 2)}`);
    } else {
      const errorText = await sendResponse.text();
      console.log(`❌ Erro ao enviar mensagem: ${sendResponse.status}`);
      console.log(`📋 Erro: ${errorText}`);
    }

  } catch (error) {
    console.error('❌ Erro durante investigação:', error.message);
  }
}

debugSpecificNumber();