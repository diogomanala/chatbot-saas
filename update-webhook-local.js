require('dotenv').config({ path: '.env.local' });

async function updateWebhookToLocal() {
    console.log('🔄 [UPDATE] Atualizando webhook para servidor local...');
    
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const baseUrl = process.env.EVOLUTION_API_URL;
    const localWebhookUrl = 'http://localhost:3000/api/webhook/evolution';
    
    if (!apiKey || !baseUrl) {
        console.error('❌ [UPDATE] Variáveis de ambiente não configuradas');
        return;
    }

    try {
        console.log('📋 [CONFIG] Configurando webhook para:', localWebhookUrl);
        
        const webhookConfig = {
            webhook: {
                url: localWebhookUrl,
                enabled: true,
                events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
                webhookByEvents: true,
                webhookBase64: false
            }
        };
        
        const response = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify(webhookConfig)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ [SUCCESS] Webhook atualizado com sucesso!');
            console.log('📋 [RESPONSE] Resposta:', JSON.stringify(result, null, 2));
            
            // Verificar se a configuração foi aplicada
            console.log('\n🔍 [VERIFY] Verificando configuração aplicada...');
            const verifyResponse = await fetch(`${baseUrl}/webhook/find/${instanceName}`, {
                method: 'GET',
                headers: {
                    'apikey': apiKey
                }
            });
            
            if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json();
                console.log('✅ [VERIFY] Configuração atual:', JSON.stringify(verifyData, null, 2));
            }
            
        } else {
            console.log('❌ [ERROR] Erro ao atualizar webhook:', response.status, response.statusText);
            const errorText = await response.text();
            console.log('📋 [ERROR] Detalhes:', errorText);
        }
        
    } catch (error) {
        console.error('❌ [ERROR] Erro:', error.message);
    }
}

updateWebhookToLocal();