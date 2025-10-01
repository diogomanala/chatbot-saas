require('dotenv').config({ path: '.env.local' });

async function checkEvolutionEvents() {
    console.log('🔍 [EVENTS] Verificando configurações de eventos na Evolution API...');
    
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    const apiKey = process.env.EVOLUTION_API_KEY;
    const baseUrl = process.env.EVOLUTION_API_URL;
    
    if (!apiKey || !baseUrl) {
        console.error('❌ [EVENTS] Variáveis de ambiente não configuradas');
        return;
    }

    try {
        // 1. Verificar status da instância
        console.log('🔗 [REQUEST] Verificando status da instância...');
        const statusResponse = await fetch(`${baseUrl}/instance/fetchInstances`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (statusResponse.ok) {
            const instances = await statusResponse.json();
            console.log('📋 [DEBUG] Estrutura das instâncias:', JSON.stringify(instances, null, 2));
            
            let targetInstance = null;
            if (Array.isArray(instances)) {
                targetInstance = instances.find(inst => 
                    (inst.instance && inst.instance.instanceName === instanceName) ||
                    (inst.instanceName === instanceName) ||
                    (inst.name === instanceName)
                );
            }
            
            if (targetInstance) {
                console.log('✅ [STATUS] Instância encontrada:');
                console.log('📱 [STATUS] Nome:', targetInstance.instance?.instanceName || targetInstance.instanceName || targetInstance.name);
                console.log('🔗 [STATUS] Conexão:', targetInstance.instance?.connectionStatus || targetInstance.connectionStatus);
                console.log('👤 [STATUS] Perfil:', targetInstance.instance?.profileName || targetInstance.profileName || 'N/A');
            } else {
                console.log('❌ [STATUS] Instância não encontrada na lista');
                console.log('📋 [STATUS] Instâncias disponíveis:', instances.map(inst => 
                    inst.instance?.instanceName || inst.instanceName || inst.name || 'Unknown'
                ));
            }
        } else {
            console.log('❌ [STATUS] Erro ao buscar instâncias:', statusResponse.status, statusResponse.statusText);
        }

        // 2. Verificar configuração atual do webhook
        console.log('\n🔗 [REQUEST] Verificando webhook atual...');
        const webhookResponse = await fetch(`${baseUrl}/webhook/find/${instanceName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (webhookResponse.ok) {
            const webhookData = await webhookResponse.json();
            console.log('✅ [WEBHOOK] Configuração atual:');
            console.log('🔗 [WEBHOOK] URL:', webhookData.url);
            console.log('✅ [WEBHOOK] Ativo:', webhookData.enabled);
            console.log('📋 [WEBHOOK] Eventos:', webhookData.events);
            console.log('🔄 [WEBHOOK] Por eventos:', webhookData.webhookByEvents);
            console.log('📝 [WEBHOOK] Base64:', webhookData.webhookBase64);
        }

        // 3. Tentar obter informações sobre eventos disponíveis
        console.log('\n🔗 [REQUEST] Verificando eventos disponíveis...');
        const eventsResponse = await fetch(`${baseUrl}/webhook/events`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            console.log('✅ [EVENTS] Eventos disponíveis:', eventsData);
        } else {
            console.log('❌ [EVENTS] Não foi possível obter eventos disponíveis:', eventsResponse.status);
        }

        // 4. Verificar se há mensagens recentes na instância
        console.log('\n🔗 [REQUEST] Verificando mensagens recentes...');
        const messagesResponse = await fetch(`${baseUrl}/chat/findMessages/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify({
                where: {
                    key: {
                        fromMe: false
                    }
                },
                limit: 5
            })
        });

        if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            console.log('✅ [MESSAGES] Mensagens recentes encontradas:', messagesData.length || 0);
            if (messagesData.length > 0) {
                console.log('📨 [MESSAGES] Última mensagem:', {
                    from: messagesData[0]?.key?.remoteJid,
                    text: messagesData[0]?.message?.conversation || messagesData[0]?.message?.extendedTextMessage?.text,
                    timestamp: messagesData[0]?.messageTimestamp
                });
            }
        } else {
            console.log('❌ [MESSAGES] Erro ao buscar mensagens:', messagesResponse.status);
        }

        // 5. Testar conectividade geral
        console.log('\n🔗 [REQUEST] Testando conectividade geral...');
        const pingResponse = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            }
        });

        if (pingResponse.ok) {
            const pingData = await pingResponse.json();
            console.log('✅ [PING] Estado da conexão:', pingData);
        } else {
            console.log('❌ [PING] Erro ao verificar estado:', pingResponse.status);
        }

    } catch (error) {
        console.error('❌ [EVENTS] Erro geral:', error);
    }
}

checkEvolutionEvents();