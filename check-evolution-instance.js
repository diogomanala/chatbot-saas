require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function checkEvolutionInstance() {
    console.log('🔍 Verificando status da instância Evolution API...\n');
    
    const evolutionUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instanceName = process.env.EVOLUTION_INSTANCE;
    
    console.log(`🌐 Evolution URL: ${evolutionUrl}`);
    console.log(`📱 Instance: ${instanceName}\n`);
    
    const headers = {
        'apikey': apiKey,
        'Content-Type': 'application/json'
    };
    
    try {
        // 1. Verificar status da instância
        console.log('📊 Verificando status da instância...');
        const statusResponse = await axios.get(
            `${evolutionUrl}/instance/connectionState/${instanceName}`,
            { headers }
        );
        
        console.log(`✅ Status da conexão: ${statusResponse.data.instance.state}`);
        console.log(`📱 Dispositivo conectado: ${statusResponse.data.instance.state === 'open' ? 'Sim' : 'Não'}\n`);
        
        // 2. Verificar configuração do webhook
        console.log('🔗 Verificando configuração do webhook...');
        const webhookResponse = await axios.get(
            `${evolutionUrl}/webhook/find/${instanceName}`,
            { headers }
        );
        
        if (webhookResponse.data.webhook) {
            console.log(`✅ Webhook configurado: ${webhookResponse.data.webhook.url}`);
            console.log(`📋 Eventos: ${webhookResponse.data.webhook.events.join(', ')}`);
            console.log(`🔄 Habilitado: ${webhookResponse.data.webhook.enabled ? 'Sim' : 'Não'}\n`);
        } else {
            console.log('❌ Webhook não configurado\n');
        }
        
        // 3. Listar mensagens recentes
        console.log('📨 Verificando mensagens recentes...');
        try {
            const messagesResponse = await axios.get(
                `${evolutionUrl}/chat/findMessages/${instanceName}`,
                { 
                    headers,
                    params: {
                        limit: 5,
                        where: JSON.stringify({
                            key: {
                                fromMe: false
                            }
                        })
                    }
                }
            );
            
            if (messagesResponse.data && messagesResponse.data.length > 0) {
                console.log(`✅ Encontradas ${messagesResponse.data.length} mensagens recentes:`);
                messagesResponse.data.forEach((msg, index) => {
                    const timestamp = new Date(msg.messageTimestamp * 1000).toLocaleString();
                    const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'Mídia/Outro';
                    console.log(`   ${index + 1}. [${timestamp}] ${msg.pushName}: ${content}`);
                });
            } else {
                console.log('⚠️  Nenhuma mensagem recente encontrada');
            }
        } catch (msgError) {
            console.log(`⚠️  Erro ao buscar mensagens: ${msgError.message}`);
        }
        
        console.log('\n📋 Diagnóstico:');
        if (statusResponse.data.instance.state === 'open') {
            console.log('✅ Instância conectada ao WhatsApp');
            if (webhookResponse.data.webhook && webhookResponse.data.webhook.enabled) {
                console.log('✅ Webhook configurado e habilitado');
                console.log('💡 Se não está recebendo mensagens, pode ser:');
                console.log('   - Mensagens não estão sendo enviadas para o WhatsApp');
                console.log('   - Problema de conectividade entre Evolution e Vercel');
                console.log('   - Filtros ou configurações bloqueando as mensagens');
            } else {
                console.log('❌ Webhook não configurado ou desabilitado');
            }
        } else {
            console.log('❌ Instância não conectada ao WhatsApp');
            console.log('💡 Conecte o dispositivo primeiro');
        }
        
    } catch (error) {
        console.log(`❌ Erro ao verificar instância: ${error.message}`);
        if (error.response) {
            console.log(`📝 Status: ${error.response.status}`);
            console.log(`📝 Data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }
}

checkEvolutionInstance().catch(console.error);