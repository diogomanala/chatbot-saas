require('dotenv').config();
const axios = require('axios');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

console.log('🔍 ENCONTRANDO INSTÂNCIA FUNCIONAL...\n');

async function findWorkingInstance() {
    try {
        console.log('📋 Configurações:');
        console.log(`URL: ${EVOLUTION_URL}`);
        console.log(`Webhook URL: ${WEBHOOK_URL}`);
        console.log(`Key: ${EVOLUTION_KEY ? '***configurada***' : 'NÃO CONFIGURADA'}\n`);

        // 1. Listar todas as instâncias
        console.log('1️⃣ Listando todas as instâncias...');
        const instancesResponse = await axios.get(
            `${EVOLUTION_URL}/instance/fetchInstances`,
            {
                headers: {
                    'apikey': EVOLUTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`📊 Total de instâncias: ${instancesResponse.data.length}\n`);

        // 2. Testar cada instância
        for (const instance of instancesResponse.data) {
            console.log(`🔍 Testando instância: ${instance.instanceName || instance.id}`);
            console.log(`📱 ID: ${instance.id}`);
            console.log(`🔗 Status: ${instance.connectionStatus}`);
            console.log(`👤 Proprietário: ${instance.ownerJid || 'Não definido'}`);

            // Tentar verificar se a instância aceita configurações de webhook
            try {
                const webhookCheckResponse = await axios.get(
                    `${EVOLUTION_URL}/webhook/find/${instance.id}`,
                    {
                        headers: {
                            'apikey': EVOLUTION_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                console.log('✅ Esta instância aceita configurações de webhook!');
                console.log('📋 Configuração atual:', JSON.stringify(webhookCheckResponse.data, null, 2));

                // Se a instância está open, tentar configurar o webhook
                if (instance.connectionStatus === 'open') {
                    console.log('\n🔧 Configurando webhook para esta instância...');
                    
                    const webhookConfig = {
                        url: WEBHOOK_URL,
                        enabled: true,
                        events: [
                            'MESSAGES_UPSERT',
                            'CONNECTION_UPDATE'
                        ]
                    };

                    try {
                        const setWebhookResponse = await axios.post(
                            `${EVOLUTION_URL}/webhook/set/${instance.id}`,
                            webhookConfig,
                            {
                                headers: {
                                    'apikey': EVOLUTION_KEY,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );

                        console.log('🎉 WEBHOOK CONFIGURADO COM SUCESSO!');
                        console.log('📊 Resposta:', JSON.stringify(setWebhookResponse.data, null, 2));
                        
                        console.log('\n📝 ATUALIZE SEU .ENV COM ESTAS INFORMAÇÕES:');
                        console.log(`EVOLUTION_INSTANCE="${instance.id}"`);
                        
                        // Testar envio de mensagem
                        if (instance.ownerJid) {
                            console.log('\n📤 Enviando mensagem de teste...');
                            const testMessage = {
                                number: instance.ownerJid.replace('@s.whatsapp.net', ''),
                                text: `🤖 Teste de webhook configurado com sucesso!\n\nInstância: ${instance.instanceName || instance.id}\nHorário: ${new Date().toLocaleString()}`
                            };

                            try {
                                const sendResponse = await axios.post(
                                    `${EVOLUTION_URL}/message/sendText/${instance.id}`,
                                    testMessage,
                                    {
                                        headers: {
                                            'apikey': EVOLUTION_KEY,
                                            'Content-Type': 'application/json'
                                        }
                                    }
                                );

                                console.log('✅ Mensagem de teste enviada!');
                                console.log('📊 Resposta:', JSON.stringify(sendResponse.data, null, 2));
                                
                                console.log('\n🎯 INSTÂNCIA FUNCIONAL ENCONTRADA E CONFIGURADA!');
                                console.log(`📱 Use esta instância: ${instance.id}`);
                                console.log('📱 Verifique se recebeu a mensagem de teste no WhatsApp');
                                
                                return; // Parar aqui, encontramos uma instância funcional
                                
                            } catch (sendError) {
                                console.log('❌ Erro ao enviar mensagem de teste:', sendError.response?.data || sendError.message);
                            }
                        }
                        
                    } catch (setError) {
                        console.log('❌ Erro ao configurar webhook:', setError.response?.data || setError.message);
                    }
                }

            } catch (webhookError) {
                console.log('❌ Esta instância não aceita configurações de webhook:', webhookError.response?.data?.message || webhookError.message);
            }

            console.log('─'.repeat(50));
        }

        console.log('\n❌ Nenhuma instância funcional encontrada.');

    } catch (error) {
        console.error('❌ Erro geral:', error.response?.data || error.message);
    }
}

findWorkingInstance();