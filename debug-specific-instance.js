require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function debugSpecificInstance() {
    console.log('🔍 Debugando instância específica...\n');
    
    // Credenciais fornecidas pelo usuário
    const webhookUrl = 'https://saas-chatbot-production.vercel.app/api/webhook/evolution';
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
    const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
    const chatbotId = 'f99ae725-f996-483d-8813-cde922d8877a';
    
    console.log('📋 Credenciais fornecidas:');
    console.log(`   🌐 Webhook: ${webhookUrl}`);
    console.log(`   📱 Instance: ${instanceName}`);
    console.log(`   🏢 Org ID: ${orgId}`);
    console.log(`   🤖 Chatbot ID: ${chatbotId}\n`);
    
    const evolutionUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    
    const headers = {
        'apikey': apiKey,
        'Content-Type': 'application/json'
    };
    
    try {
        // 1. Verificar status da instância
        console.log('📊 1. Verificando status da instância...');
        const statusResponse = await axios.get(
            `${evolutionUrl}/instance/connectionState/${instanceName}`,
            { headers }
        );
        
        console.log(`   ✅ Status: ${statusResponse.data.instance.state}`);
        console.log(`   📱 Conectado: ${statusResponse.data.instance.state === 'open' ? 'Sim' : 'Não'}\n`);
        
        // 2. Verificar configuração do webhook
        console.log('🔗 2. Verificando configuração do webhook...');
        const webhookResponse = await axios.get(
            `${evolutionUrl}/webhook/find/${instanceName}`,
            { headers }
        );
        
        if (webhookResponse.data.webhook) {
            const webhook = webhookResponse.data.webhook;
            console.log(`   ✅ URL configurada: ${webhook.url}`);
            console.log(`   📋 Eventos: ${webhook.events.join(', ')}`);
            console.log(`   🔄 Habilitado: ${webhook.enabled ? 'Sim' : 'Não'}`);
            console.log(`   🆔 Webhook ID: ${webhook.id}`);
            
            // Verificar se a URL está correta
            if (webhook.url === webhookUrl) {
                console.log('   ✅ URL do webhook está correta');
            } else {
                console.log(`   ❌ URL incorreta! Esperado: ${webhookUrl}`);
            }
        } else {
            console.log('   ❌ Webhook não configurado');
        }
        console.log('');
        
        // 3. Testar conectividade com o webhook
        console.log('🌐 3. Testando conectividade com webhook...');
        try {
            const testResponse = await axios.get(webhookUrl, {
                timeout: 10000,
                validateStatus: function (status) {
                    return status < 500;
                }
            });
            console.log(`   ✅ Webhook acessível - Status: ${testResponse.status}\n`);
        } catch (error) {
            console.log(`   ❌ Erro ao acessar webhook: ${error.message}\n`);
        }
        
        // 4. Simular mensagem real com as credenciais específicas
        console.log('📨 4. Simulando mensagem com credenciais específicas...');
        const testMessage = {
            event: 'messages.upsert',
            instance: instanceName,
            data: {
                key: {
                    remoteJid: '5511999999999@s.whatsapp.net',
                    fromMe: false,
                    id: 'DEBUG_MESSAGE_' + Date.now()
                },
                message: {
                    conversation: 'Teste de debug com credenciais específicas'
                },
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: 'Debug User',
                instanceId: instanceName
            },
            // Adicionar metadados específicos
            orgId: orgId,
            chatbotId: chatbotId
        };
        
        try {
            const postResponse = await axios.post(webhookUrl, testMessage, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Evolution-API-Debug'
                },
                timeout: 15000
            });
            
            console.log(`   ✅ Mensagem enviada - Status: ${postResponse.status}`);
            console.log(`   📝 Resposta: ${JSON.stringify(postResponse.data, null, 2)}\n`);
            
        } catch (error) {
            console.log(`   ❌ Erro ao enviar mensagem: ${error.message}`);
            if (error.response) {
                console.log(`   📝 Status: ${error.response.status}`);
                console.log(`   📝 Data: ${JSON.stringify(error.response.data, null, 2)}`);
            }
            console.log('');
        }
        
        // 5. Verificar mensagens recentes na instância
        console.log('📬 5. Verificando mensagens recentes na instância...');
        try {
            const messagesResponse = await axios.get(
                `${evolutionUrl}/chat/findMessages/${instanceName}`,
                { 
                    headers,
                    params: {
                        limit: 3,
                        where: JSON.stringify({
                            key: {
                                fromMe: false
                            }
                        })
                    }
                }
            );
            
            if (messagesResponse.data && messagesResponse.data.length > 0) {
                console.log(`   ✅ ${messagesResponse.data.length} mensagens recentes encontradas:`);
                messagesResponse.data.forEach((msg, index) => {
                    const timestamp = new Date(msg.messageTimestamp * 1000).toLocaleString();
                    const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'Mídia/Outro';
                    console.log(`      ${index + 1}. [${timestamp}] ${msg.pushName}: ${content.substring(0, 50)}...`);
                });
            } else {
                console.log('   ⚠️  Nenhuma mensagem recente encontrada');
            }
        } catch (msgError) {
            console.log(`   ⚠️  Erro ao buscar mensagens: ${msgError.message}`);
        }
        
        console.log('\n📋 DIAGNÓSTICO FINAL:');
        console.log('='.repeat(50));
        
        if (statusResponse.data.instance.state === 'open') {
            console.log('✅ Instância conectada ao WhatsApp');
            
            if (webhookResponse.data.webhook && webhookResponse.data.webhook.enabled) {
                console.log('✅ Webhook configurado e habilitado');
                
                if (webhookResponse.data.webhook.url === webhookUrl) {
                    console.log('✅ URL do webhook está correta');
                    console.log('\n💡 POSSÍVEIS CAUSAS:');
                    console.log('   1. Mensagens não estão sendo enviadas para o WhatsApp');
                    console.log('   2. Filtros ou configurações bloqueando mensagens');
                    console.log('   3. Problema no mapeamento org_id -> chatbot_id');
                    console.log('   4. Erro no processamento interno do webhook');
                    console.log('\n🔧 PRÓXIMOS PASSOS:');
                    console.log('   1. Envie uma mensagem real pelo WhatsApp');
                    console.log('   2. Verifique os logs do Vercel');
                    console.log('   3. Monitore o banco de dados');
                } else {
                    console.log('❌ URL do webhook incorreta - precisa ser reconfigurada');
                }
            } else {
                console.log('❌ Webhook não configurado ou desabilitado');
            }
        } else {
            console.log('❌ Instância não conectada ao WhatsApp');
        }
        
    } catch (error) {
        console.log(`❌ Erro geral: ${error.message}`);
        if (error.response) {
            console.log(`📝 Status: ${error.response.status}`);
            console.log(`📝 Data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }
}

debugSpecificInstance().catch(console.error);