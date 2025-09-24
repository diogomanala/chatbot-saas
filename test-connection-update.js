require('dotenv').config({ path: '.env.local' });

async function testConnectionUpdateWebhook() {
    console.log('🔄 [TEST] Testando webhook connection-update...');
    
    const webhookUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution/connection-update';
    
    // Payload de teste para connection update
    const testPayload = {
        instance: {
            instanceName: 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77'
        },
        state: 'open',
        statusReason: 'connected'
    };

    try {
        console.log('📡 [TEST] Enviando payload para:', webhookUrl);
        console.log('📦 [TEST] Payload:', JSON.stringify(testPayload, null, 2));
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });

        console.log('📊 [TEST] Status da resposta:', response.status);
        console.log('📊 [TEST] Headers da resposta:', Object.fromEntries(response.headers.entries()));
        
        const responseText = await response.text();
        console.log('📄 [TEST] Resposta completa:', responseText);

        if (response.ok) {
            try {
                const jsonResponse = JSON.parse(responseText);
                console.log('✅ [TEST] Resposta JSON:', jsonResponse);
            } catch {
                console.log('⚠️ [TEST] Resposta não é JSON válido');
            }
        } else {
            console.log('❌ [TEST] Erro na requisição:', response.status, responseText);
        }

    } catch (error) {
        console.error('❌ [TEST] Erro ao testar webhook:', error);
    }

    // Testar também com GET
    console.log('\n🔍 [TEST] Testando endpoint com GET...');
    try {
        const getResponse = await fetch(webhookUrl, {
            method: 'GET'
        });
        
        console.log('📊 [GET] Status:', getResponse.status);
        const getResponseText = await getResponse.text();
        console.log('📄 [GET] Resposta:', getResponseText);
        
    } catch (error) {
        console.error('❌ [GET] Erro:', error);
    }
}

testConnectionUpdateWebhook();