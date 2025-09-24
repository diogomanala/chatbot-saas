require('dotenv').config({ path: '.env.local' });

async function testWhatsAppConnection() {
    console.log('📱 [WHATSAPP] Testando conexão do WhatsApp...');
    
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const baseUrl = process.env.EVOLUTION_API_URL;
    
    if (!apiKey || !baseUrl) {
        console.error('❌ [WHATSAPP] Variáveis de ambiente não configuradas');
        return;
    }

    try {
        // 1. Verificar informações detalhadas da instância
        console.log('🔗 [REQUEST] Buscando informações detalhadas da instância...');
        const instanceResponse = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (instanceResponse.ok) {
            const instanceData = await instanceResponse.json();
            console.log('✅ [INSTANCE] Dados da instância:', JSON.stringify(instanceData, null, 2));
        }

        // 2. Verificar chats ativos
        console.log('\n🔗 [REQUEST] Verificando chats ativos...');
        const chatsResponse = await fetch(`${baseUrl}/chat/findChats/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify({
                where: {},
                limit: 10
            })
        });

        if (chatsResponse.ok) {
            const chatsData = await chatsResponse.json();
            console.log('✅ [CHATS] Chats encontrados:', chatsData.length);
            if (chatsData.length > 0) {
                console.log('📋 [CHATS] Primeiros chats:');
                chatsData.slice(0, 3).forEach((chat, index) => {
                    console.log(`  ${index + 1}. ${chat.id} - ${chat.name || 'Sem nome'}`);
                });
            }
        } else {
            console.log('❌ [CHATS] Erro ao buscar chats:', chatsResponse.status);
        }

        // 3. Verificar mensagens das últimas 24 horas
        console.log('\n🔗 [REQUEST] Verificando mensagens das últimas 24 horas...');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const recentMessagesResponse = await fetch(`${baseUrl}/chat/findMessages/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify({
                where: {
                    messageTimestamp: {
                        $gte: Math.floor(yesterday.getTime() / 1000)
                    }
                },
                limit: 20
            })
        });

        if (recentMessagesResponse.ok) {
            const recentMessages = await recentMessagesResponse.json();
            console.log('✅ [RECENT] Mensagens das últimas 24h:', recentMessages.length);
            
            if (recentMessages.length > 0) {
                console.log('📨 [RECENT] Últimas mensagens:');
                recentMessages.slice(0, 5).forEach((msg, index) => {
                    const text = msg.message?.conversation || 
                                msg.message?.extendedTextMessage?.text || 
                                msg.message?.imageMessage?.caption ||
                                'Mensagem sem texto';
                    const from = msg.key?.remoteJid?.replace('@s.whatsapp.net', '');
                    const timestamp = new Date(msg.messageTimestamp * 1000).toLocaleString('pt-BR');
                    console.log(`  ${index + 1}. [${timestamp}] ${from}: ${text.substring(0, 50)}...`);
                });
            }
        } else {
            console.log('❌ [RECENT] Erro ao buscar mensagens recentes:', recentMessagesResponse.status);
        }

        // 4. Verificar todas as mensagens (sem filtro de data)
        console.log('\n🔗 [REQUEST] Verificando todas as mensagens...');
        const allMessagesResponse = await fetch(`${baseUrl}/chat/findMessages/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify({
                where: {},
                limit: 10,
                sort: { messageTimestamp: -1 }
            })
        });

        if (allMessagesResponse.ok) {
            const allMessages = await allMessagesResponse.json();
            console.log('✅ [ALL] Total de mensagens encontradas:', allMessages.length);
            
            if (allMessages.length > 0) {
                console.log('📨 [ALL] Mensagens mais recentes:');
                allMessages.slice(0, 3).forEach((msg, index) => {
                    const text = msg.message?.conversation || 
                                msg.message?.extendedTextMessage?.text || 
                                'Mensagem sem texto';
                    const from = msg.key?.remoteJid?.replace('@s.whatsapp.net', '');
                    const timestamp = new Date(msg.messageTimestamp * 1000).toLocaleString('pt-BR');
                    const fromMe = msg.key?.fromMe ? '(Enviada)' : '(Recebida)';
                    console.log(`  ${index + 1}. [${timestamp}] ${from} ${fromMe}: ${text.substring(0, 50)}...`);
                });
            }
        } else {
            console.log('❌ [ALL] Erro ao buscar todas as mensagens:', allMessagesResponse.status);
        }

        // 5. Verificar configurações da instância
        console.log('\n🔗 [REQUEST] Verificando configurações da instância...');
        const settingsResponse = await fetch(`${baseUrl}/settings/find/${instanceName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (settingsResponse.ok) {
            const settings = await settingsResponse.json();
            console.log('✅ [SETTINGS] Configurações:');
            console.log('📖 [SETTINGS] Ler mensagens:', settings.readMessages);
            console.log('📊 [SETTINGS] Status de leitura:', settings.readStatus);
            console.log('🌐 [SETTINGS] Sempre online:', settings.alwaysOnline);
            console.log('📞 [SETTINGS] Rejeitar chamadas:', settings.rejectCall);
            console.log('👥 [SETTINGS] Ignorar grupos:', settings.groupsIgnore);
        } else {
            console.log('❌ [SETTINGS] Erro ao buscar configurações:', settingsResponse.status);
        }

    } catch (error) {
        console.error('❌ [WHATSAPP] Erro geral:', error);
    }
}

testWhatsAppConnection();