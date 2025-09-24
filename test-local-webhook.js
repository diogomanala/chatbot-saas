require('dotenv').config({ path: '.env.local' });

async function testLocalWebhook() {
    console.log('🧪 [LOCAL-TEST] Testando webhook local...');
    
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    // const apiKey = process.env.EVOLUTION_API_KEY;
    // const baseUrl = process.env.EVOLUTION_API_URL;
    
    // Testar webhook atual (Vercel)
    console.log('1️⃣ Testando webhook atual (Vercel)...');
    const currentWebhookUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';
    
    const testPayload = {
        event: 'messages.upsert',
        instance: instanceName,
        data: {
            message: {
                text: 'Teste do sistema local',
                key: {
                    remoteJid: '5511999999999@s.whatsapp.net'
                }
            }
        }
    };

    try {
        const response = await fetch(currentWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });

        console.log(`📊 Status Vercel: ${response.status}`);
        const result = await response.text();
        console.log(`📋 Resposta Vercel: ${result.substring(0, 200)}...`);
    } catch (error) {
        console.error('❌ Erro Vercel:', error.message);
    }

    // Testar webhook local
    console.log('\n2️⃣ Testando webhook local...');
    const localWebhookUrl = 'http://localhost:3000/api/webhook/simple';
    
    try {
        const response = await fetch(localWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });

        console.log(`📊 Status Local: ${response.status}`);
        const result = await response.text();
        console.log(`📋 Resposta Local: ${result}`);
    } catch (error) {
        console.error('❌ Erro Local:', error.message);
    }

    // Testar serviço de IA diretamente
    console.log('\n3️⃣ Testando serviço de IA diretamente...');
    const testAiUrl = 'http://localhost:3000/api/test-simple';
    
    try {
        const response = await fetch(testAiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: '5511999999999',
                message: 'Olá, como você pode me ajudar?',
                instanceId: instanceName
            })
        });

        console.log(`📊 Status IA: ${response.status}`);
        const result = await response.json();
        console.log(`📋 Resposta IA:`, JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Erro IA:', error.message);
    }
}

testLocalWebhook();