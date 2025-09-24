require('dotenv').config({ path: '.env.local' });

async function testWebhookPayload() {
    console.log('🧪 [WEBHOOK-TEST] Testando diferentes payloads do webhook...');
    
    const webhookUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    
    // Payload de teste simples (como usado em testes)
    const testPayload = {
        event: 'messages.upsert',
        instance: instanceName,
        data: {
            key: {
                remoteJid: '5511999999999@s.whatsapp.net',
                fromMe: false,
                id: 'test_message_id_' + Date.now()
            },
            message: {
                conversation: 'Mensagem de teste'
            },
            messageType: 'conversation',
            messageTimestamp: Date.now(),
            pushName: 'Teste User',
            body: 'Mensagem de teste'
        }
    };
    
    // Payload mais realista (como vem da Evolution API real)
    const realisticPayload = {
        event: 'messages.upsert',
        instance: instanceName,
        data: {
            messages: [{
                key: {
                    remoteJid: '5511999999999@s.whatsapp.net',
                    fromMe: false,
                    id: '3EB0C431C5177D1D2C4E',
                    participant: undefined
                },
                message: {
                    conversation: 'Olá, preciso de ajuda'
                },
                messageType: 'conversation',
                messageTimestamp: 1737462000,
                pushName: 'João Silva',
                status: 'RECEIVED'
            }]
        }
    };
    
    // Payload de conexão
    const connectionPayload = {
        event: 'connection.update',
        instance: instanceName,
        data: {
            state: 'open'
        }
    };

    const payloads = [
        { name: 'Teste Simples', payload: testPayload },
        { name: 'Realístico', payload: realisticPayload },
        { name: 'Conexão', payload: connectionPayload }
    ];

    for (const { name, payload } of payloads) {
        console.log(`\n🔗 [REQUEST] Testando payload: ${name}`);
        console.log('📦 [PAYLOAD]', JSON.stringify(payload, null, 2));
        
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-webhook-secret': process.env.WEBHOOK_SECRET || ''
                },
                body: JSON.stringify(payload)
            });

            const responseText = await response.text();
            console.log(`✅ [RESPONSE] Status: ${response.status} ${response.statusText}`);
            console.log(`📄 [RESPONSE] Body:`, responseText);
            
            if (!response.ok) {
                console.log(`❌ [ERROR] Falha no payload ${name}`);
            }
            
        } catch (error) {
            console.error(`❌ [ERROR] Erro ao testar payload ${name}:`, error.message);
        }
        
        // Aguardar um pouco entre os testes
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

testWebhookPayload();