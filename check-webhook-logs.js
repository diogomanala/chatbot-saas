require('dotenv').config({ path: '.env.local' });

async function checkWebhookLogs() {
    console.log('📊 [LOGS] Verificando logs recentes do webhook...');
    
    // Simular uma mensagem real para ver se gera logs
    const webhookUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    
    // Payload que simula uma mensagem real do WhatsApp
    const realMessagePayload = {
        event: 'messages.upsert',
        instance: instanceName,
        data: {
            messages: [{
                key: {
                    remoteJid: '5511987654321@s.whatsapp.net',
                    fromMe: false,
                    id: '3EB0C431C5177D1D2C4E' + Date.now(),
                    participant: undefined
                },
                message: {
                    conversation: 'Olá, gostaria de saber sobre os serviços'
                },
                messageType: 'conversation',
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: 'Cliente Real',
                status: 'RECEIVED'
            }]
        }
    };
    
    console.log('📦 [PAYLOAD] Enviando mensagem simulada:');
    console.log(JSON.stringify(realMessagePayload, null, 2));
    
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': process.env.WEBHOOK_SECRET || ''
            },
            body: JSON.stringify(realMessagePayload)
        });

        const responseText = await response.text();
        console.log(`\n✅ [RESPONSE] Status: ${response.status} ${response.statusText}`);
        console.log(`📄 [RESPONSE] Body:`, responseText);
        
        if (response.ok) {
            console.log('\n🎉 [SUCCESS] Webhook processado com sucesso!');
            console.log('📝 [INFO] Verifique os logs da Vercel para mais detalhes.');
            console.log('🔗 [INFO] URL dos logs: https://vercel.com/dashboard');
        } else {
            console.log('\n❌ [ERROR] Webhook falhou');
        }
        
    } catch (error) {
        console.error('❌ [ERROR] Erro ao enviar webhook:', error.message);
    }
    
    // Aguardar um pouco e tentar novamente com payload diferente
    console.log('\n⏳ [WAIT] Aguardando 3 segundos...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Payload com estrutura mais simples
    const simplePayload = {
        event: 'messages.upsert',
        instance: instanceName,
        data: {
            key: {
                remoteJid: '5511987654321@s.whatsapp.net',
                fromMe: false,
                id: 'simple_' + Date.now()
            },
            message: {
                conversation: 'Teste simples'
            },
            messageType: 'conversation',
            messageTimestamp: Date.now(),
            pushName: 'Teste Simples'
        }
    };
    
    console.log('📦 [PAYLOAD] Enviando payload simples:');
    console.log(JSON.stringify(simplePayload, null, 2));
    
    try {
        const response2 = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': process.env.WEBHOOK_SECRET || ''
            },
            body: JSON.stringify(simplePayload)
        });

        const responseText2 = await response2.text();
        console.log(`\n✅ [RESPONSE2] Status: ${response2.status} ${response2.statusText}`);
        console.log(`📄 [RESPONSE2] Body:`, responseText2);
        
    } catch (error) {
        console.error('❌ [ERROR2] Erro ao enviar segundo webhook:', error.message);
    }
}

checkWebhookLogs();