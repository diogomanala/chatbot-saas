require('dotenv').config({ path: '.env.local' });

async function fixWebhookUrl() {
    console.log('🔧 [WEBHOOK-FIX] Corrigindo URL do webhook...');
    
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const baseUrl = process.env.EVOLUTION_API_URL;
    const correctWebhookUrl = process.env.WEBHOOK_URL;
    
    if (!apiKey || !baseUrl || !correctWebhookUrl) {
        console.error('❌ [WEBHOOK-FIX] Variáveis de ambiente não configuradas');
        console.error('EVOLUTION_API_KEY:', apiKey ? 'Configurada' : 'Não configurada');
        console.error('EVOLUTION_API_URL:', baseUrl ? 'Configurada' : 'Não configurada');
        console.error('WEBHOOK_URL:', correctWebhookUrl ? 'Configurada' : 'Não configurada');
        return;
    }

    console.log('🔗 [WEBHOOK-FIX] URL correta do webhook:', correctWebhookUrl);

    try {
        // Atualizar a configuração do webhook
        console.log('🔗 [REQUEST] Atualizando webhook...');
        const updateResponse = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify({
                url: correctWebhookUrl,
                enabled: true,
                events: ['MESSAGES_UPSERT'],
                webhookByEvents: true,
                webhookBase64: false
            })
        });

        if (updateResponse.ok) {
            const updateData = await updateResponse.json();
            console.log('✅ [WEBHOOK-FIX] Webhook atualizado com sucesso:');
            console.log(JSON.stringify(updateData, null, 2));
        } else {
            console.log('❌ [WEBHOOK-FIX] Erro ao atualizar webhook:', updateResponse.status, updateResponse.statusText);
            const errorText = await updateResponse.text();
            console.log('Erro:', errorText);
        }

        // Verificar se a atualização foi aplicada
        console.log('\n🔗 [REQUEST] Verificando configuração atualizada...');
        const verifyResponse = await fetch(`${baseUrl}/webhook/find/${instanceName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            console.log('✅ [WEBHOOK-FIX] Configuração atual após atualização:');
            console.log(JSON.stringify(verifyData, null, 2));
            
            if (verifyData.url === correctWebhookUrl) {
                console.log('🎉 [WEBHOOK-FIX] URL do webhook corrigida com sucesso!');
            } else {
                console.log('⚠️ [WEBHOOK-FIX] URL ainda não está correta. Esperado:', correctWebhookUrl);
                console.log('⚠️ [WEBHOOK-FIX] Atual:', verifyData.url);
            }
        } else {
            console.log('❌ [WEBHOOK-FIX] Erro ao verificar webhook:', verifyResponse.status, verifyResponse.statusText);
        }

    } catch (error) {
        console.error('❌ [WEBHOOK-FIX] Erro geral:', error);
    }
}

fixWebhookUrl();