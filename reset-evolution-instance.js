require('dotenv').config({ path: '.env.local' });

async function resetEvolutionInstance() {
    console.log('🔄 [RESET] Iniciando procedimento de reset e reconfiguração...');
    
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const baseUrl = process.env.EVOLUTION_API_URL;
    const webhookUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';
    
    if (!apiKey || !baseUrl) {
        console.error('❌ [RESET] Variáveis de ambiente não configuradas');
        return;
    }

    try {
        // ETAPA 1: Atualizar configuração do webhook
        console.log('📡 [STEP 1] Atualizando configuração do webhook...');
        const webhookResponse = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify({
                webhook: {
                    url: webhookUrl,
                    enabled: true,
                    events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
                    webhookByEvents: true,
                    webhookBase64: false
                }
            })
        });

        if (webhookResponse.ok) {
            const webhookResult = await webhookResponse.json();
            console.log('✅ [WEBHOOK] Configuração atualizada com sucesso:');
            console.log('🔗 [WEBHOOK] URL:', webhookResult.url);
            console.log('📋 [WEBHOOK] Eventos:', webhookResult.events);
            console.log('✅ [WEBHOOK] Ativo:', webhookResult.enabled);
        } else {
            const errorText = await webhookResponse.text();
            console.log('❌ [WEBHOOK] Erro ao atualizar webhook:', webhookResponse.status, errorText);
            return;
        }

        // ETAPA 2: Forçar desconexão da instância
        console.log('\n🔌 [STEP 2] Forçando desconexão da instância...');
        const logoutResponse = await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (logoutResponse.ok) {
            const logoutResult = await logoutResponse.json();
            console.log('✅ [LOGOUT] Instância desconectada com sucesso:', logoutResult);
        } else {
            const errorText = await logoutResponse.text();
            console.log('⚠️ [LOGOUT] Resposta da desconexão:', logoutResponse.status, errorText);
            // Continuar mesmo se houver erro, pois a instância pode já estar desconectada
        }

        // Aguardar um momento para garantir que a desconexão foi processada
        console.log('⏳ [WAIT] Aguardando 3 segundos para processar desconexão...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // ETAPA 3: Gerar novo QR Code para reconexão
        console.log('\n📱 [STEP 3] Gerando novo QR Code para reconexão...');
        const connectResponse = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (connectResponse.ok) {
            const connectResult = await connectResponse.json();
            console.log('✅ [QR_CODE] Novo QR Code gerado com sucesso!');
            
            if (connectResult.base64) {
                console.log('🖼️ [QR_CODE] QR Code em Base64:');
                console.log(connectResult.base64);
                console.log('\n📋 [QR_CODE] Para visualizar o QR Code:');
                console.log('1. Copie o código Base64 acima');
                console.log('2. Cole em um decodificador Base64 para imagem');
                console.log('3. Ou use: data:image/png;base64,' + connectResult.base64);
            }
            
            if (connectResult.code) {
                console.log('🔗 [QR_CODE] Código QR:', connectResult.code);
            }
            
            console.log('📱 [QR_CODE] Status:', connectResult.status || 'Aguardando conexão');
            
        } else {
            const errorText = await connectResponse.text();
            console.log('❌ [QR_CODE] Erro ao gerar QR Code:', connectResponse.status, errorText);
            return;
        }

        // ETAPA 4: Verificar status final
        console.log('\n🔍 [STEP 4] Verificando configuração final...');
        
        // Verificar webhook atualizado
        const finalWebhookResponse = await fetch(`${baseUrl}/webhook/find/${instanceName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (finalWebhookResponse.ok) {
            const finalWebhook = await finalWebhookResponse.json();
            console.log('✅ [FINAL] Configuração final do webhook:');
            console.log('🔗 [FINAL] URL:', finalWebhook.url);
            console.log('📋 [FINAL] Eventos:', finalWebhook.events);
            console.log('✅ [FINAL] Ativo:', finalWebhook.enabled);
            console.log('🔄 [FINAL] Por eventos:', finalWebhook.webhookByEvents);
        }

        // Verificar status da instância
        const statusResponse = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (statusResponse.ok) {
            const status = await statusResponse.json();
            console.log('📊 [FINAL] Status da instância:', status);
        }

        console.log('\n🎉 [SUCCESS] Procedimento de reset concluído com sucesso!');
        console.log('📋 [NEXT] Próximos passos:');
        console.log('1. Escaneie o QR Code com o WhatsApp');
        console.log('2. Aguarde a conexão ser estabelecida');
        console.log('3. Teste o envio de mensagens');
        console.log('4. Verifique se os webhooks estão funcionando');

    } catch (error) {
        console.error('❌ [RESET] Erro geral:', error);
    }
}

resetEvolutionInstance();