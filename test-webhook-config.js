require('dotenv').config({ path: '.env.local' });

async function testWebhookConfig() {
    console.log('🔍 [WEBHOOK-CONFIG] Verificando configuração do webhook...');
    
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const baseUrl = process.env.EVOLUTION_API_URL;
    
    if (!apiKey || !baseUrl) {
        console.error('❌ [WEBHOOK-CONFIG] Variáveis de ambiente não configuradas');
        console.error('EVOLUTION_API_KEY:', apiKey ? 'Configurada' : 'Não configurada');
        console.error('EVOLUTION_API_URL:', baseUrl ? 'Configurada' : 'Não configurada');
        return;
    }

    try {
        // 1. Verificar configuração atual do webhook
        console.log('🔗 [REQUEST] Verificando webhook atual...');
        const webhookResponse = await fetch(`${baseUrl}/webhook/find/${instanceName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (webhookResponse.ok) {
            const webhookData = await webhookResponse.json();
            console.log('✅ [WEBHOOK-CONFIG] Configuração atual do webhook:');
            console.log(JSON.stringify(webhookData, null, 2));
        } else {
            console.log('❌ [WEBHOOK-CONFIG] Erro ao buscar webhook:', webhookResponse.status, webhookResponse.statusText);
            const errorText = await webhookResponse.text();
            console.log('Erro:', errorText);
        }

        // 2. Verificar eventos configurados
        console.log('\n🔗 [REQUEST] Verificando eventos configurados...');
        const eventsResponse = await fetch(`${baseUrl}/webhook/events/${instanceName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            console.log('✅ [WEBHOOK-CONFIG] Eventos configurados:');
            console.log(JSON.stringify(eventsData, null, 2));
        } else {
            console.log('❌ [WEBHOOK-CONFIG] Erro ao buscar eventos:', eventsResponse.status, eventsResponse.statusText);
        }

        // 3. Testar conectividade com o webhook URL
        console.log('\n🔗 [REQUEST] Testando conectividade com webhook URL...');
        const webhookUrl = process.env.WEBHOOK_URL;
        console.log('Webhook URL configurada:', webhookUrl);
        
        if (webhookUrl) {
            try {
                const testResponse = await fetch(webhookUrl, {
                    method: 'GET',
                    timeout: 5000
                });
                console.log('✅ [WEBHOOK-CONFIG] Webhook URL acessível:', testResponse.status, testResponse.statusText);
            } catch (testError) {
                console.log('❌ [WEBHOOK-CONFIG] Erro ao acessar webhook URL:', testError.message);
            }
        }

    } catch (error) {
        console.error('❌ [WEBHOOK-CONFIG] Erro geral:', error);
    }
}

testWebhookConfig();