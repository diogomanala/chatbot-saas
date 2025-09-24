require('dotenv').config();
const axios = require('axios');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

console.log('🔧 CONFIGURANDO DEVICE CORRETO...\n');

async function configureCorrectDevice() {
    try {
        console.log('📋 Configurações:');
        console.log(`URL: ${EVOLUTION_URL}`);
        console.log(`Instance ID: ${EVOLUTION_INSTANCE}`);
        console.log(`Webhook URL: ${WEBHOOK_URL}`);
        console.log(`Key: ${EVOLUTION_KEY ? '***configurada***' : 'NÃO CONFIGURADA'}\n`);

        // 1. Verificar se a instância existe
        console.log('1️⃣ Verificando se a instância existe...');
        const instancesResponse = await axios.get(
            `${EVOLUTION_URL}/instance/fetchInstances`,
            {
                headers: {
                    'apikey': EVOLUTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`📊 Total de instâncias encontradas: ${instancesResponse.data.length}`);
        
        const ourInstance = instancesResponse.data.find(inst => 
            inst.instanceName === EVOLUTION_INSTANCE || 
            inst.id === EVOLUTION_INSTANCE
        );
        
        if (ourInstance) {
            console.log('✅ Instância encontrada!');
            console.log(`📱 Nome: ${ourInstance.instanceName}`);
            console.log(`🆔 ID: ${ourInstance.id}`);
            console.log(`🔗 Status: ${ourInstance.connectionStatus}`);
            console.log(`👤 Proprietário: ${ourInstance.ownerJid || 'Não definido'}`);
        } else {
            console.log('❌ Instância não encontrada na lista!');
            console.log('📋 Instâncias disponíveis:');
            instancesResponse.data.forEach((inst, index) => {
                console.log(`   ${index + 1}. Nome: ${inst.instanceName || 'Sem nome'} | ID: ${inst.id} | Status: ${inst.connectionStatus}`);
            });
            return;
        }

        // 2. Verificar status da conexão
        console.log('\n2️⃣ Verificando status detalhado da conexão...');
        try {
            const connectionResponse = await axios.get(
                `${EVOLUTION_URL}/instance/connectionState/${ourInstance.instanceName || ourInstance.id}`,
                {
                    headers: {
                        'apikey': EVOLUTION_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('📊 Estado da conexão:', JSON.stringify(connectionResponse.data, null, 2));
            
        } catch (connectionError) {
            console.log('⚠️  Erro ao verificar estado da conexão:', connectionError.response?.data || connectionError.message);
        }

        // 3. Configurar webhook
        console.log('\n3️⃣ Configurando webhook...');
        const webhookConfig = {
            url: WEBHOOK_URL,
            enabled: true,
            events: [
                'MESSAGES_UPSERT',
                'CONNECTION_UPDATE'
            ]
        };

        try {
            const webhookResponse = await axios.post(
                `${EVOLUTION_URL}/webhook/set/${ourInstance.instanceName || ourInstance.id}`,
                webhookConfig,
                {
                    headers: {
                        'apikey': EVOLUTION_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ Webhook configurado com sucesso!');
            console.log('📊 Resposta:', JSON.stringify(webhookResponse.data, null, 2));

        } catch (webhookError) {
            console.log('❌ Erro ao configurar webhook:', webhookError.response?.data || webhookError.message);
            
            // Tentar com o ID da instância se falhou com o nome
            if (ourInstance.instanceName && ourInstance.id !== ourInstance.instanceName) {
                console.log('\n🔄 Tentando configurar webhook com ID da instância...');
                try {
                    const webhookResponse2 = await axios.post(
                        `${EVOLUTION_URL}/webhook/set/${ourInstance.id}`,
                        webhookConfig,
                        {
                            headers: {
                                'apikey': EVOLUTION_KEY,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    console.log('✅ Webhook configurado com sucesso usando ID!');
                    console.log('📊 Resposta:', JSON.stringify(webhookResponse2.data, null, 2));

                } catch (webhookError2) {
                    console.log('❌ Erro ao configurar webhook com ID:', webhookError2.response?.data || webhookError2.message);
                }
            }
        }

        // 4. Verificar configuração do webhook
        console.log('\n4️⃣ Verificando configuração do webhook...');
        try {
            const checkResponse = await axios.get(
                `${EVOLUTION_URL}/webhook/find/${ourInstance.instanceName || ourInstance.id}`,
                {
                    headers: {
                        'apikey': EVOLUTION_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('📋 Configuração atual do webhook:');
            console.log(JSON.stringify(checkResponse.data, null, 2));

        } catch (checkError) {
            console.log('⚠️  Erro ao verificar webhook:', checkError.response?.data || checkError.message);
            
            // Tentar com ID se falhou com nome
            if (ourInstance.instanceName && ourInstance.id !== ourInstance.instanceName) {
                try {
                    const checkResponse2 = await axios.get(
                        `${EVOLUTION_URL}/webhook/find/${ourInstance.id}`,
                        {
                            headers: {
                                'apikey': EVOLUTION_KEY,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    console.log('📋 Configuração atual do webhook (usando ID):');
                    console.log(JSON.stringify(checkResponse2.data, null, 2));

                } catch (checkError2) {
                    console.log('❌ Erro ao verificar webhook com ID:', checkError2.response?.data || checkError2.message);
                }
            }
        }

        // 5. Testar envio de mensagem se a instância estiver conectada
        if (ourInstance.connectionStatus === 'open' && ourInstance.ownerJid) {
            console.log('\n5️⃣ Testando envio de mensagem...');
            const testMessage = {
                number: ourInstance.ownerJid.replace('@s.whatsapp.net', ''),
                text: `🤖 Teste de configuração do device correto!\n\nDevice: ${ourInstance.instanceName}\nHorário: ${new Date().toLocaleString()}\n\nSe você recebeu esta mensagem, a configuração está funcionando! 🎉`
            };

            try {
                const sendResponse = await axios.post(
                    `${EVOLUTION_URL}/message/sendText/${ourInstance.instanceName || ourInstance.id}`,
                    testMessage,
                    {
                        headers: {
                            'apikey': EVOLUTION_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                console.log('📤 Mensagem de teste enviada!');
                console.log('📊 Resposta:', JSON.stringify(sendResponse.data, null, 2));
                
                console.log('\n🎉 CONFIGURAÇÃO COMPLETA!');
                console.log('📱 Verifique se recebeu a mensagem de teste no WhatsApp');
                console.log('🔍 Monitore os logs do seu servidor para ver se o webhook está recebendo eventos');
                
            } catch (sendError) {
                console.log('❌ Erro ao enviar mensagem de teste:', sendError.response?.data || sendError.message);
                
                // Tentar com ID se falhou com nome
                if (ourInstance.instanceName && ourInstance.id !== ourInstance.instanceName) {
                    try {
                        const sendResponse2 = await axios.post(
                            `${EVOLUTION_URL}/message/sendText/${ourInstance.id}`,
                            testMessage,
                            {
                                headers: {
                                    'apikey': EVOLUTION_KEY,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );

                        console.log('📤 Mensagem de teste enviada usando ID!');
                        console.log('📊 Resposta:', JSON.stringify(sendResponse2.data, null, 2));
                        
                    } catch (sendError2) {
                        console.log('❌ Erro ao enviar mensagem com ID:', sendError2.response?.data || sendError2.message);
                    }
                }
            }
        } else {
            console.log('\n⚠️  Instância não está conectada ou não tem proprietário definido. Não é possível testar envio de mensagem.');
            console.log(`Status: ${ourInstance.connectionStatus}`);
            console.log(`Proprietário: ${ourInstance.ownerJid || 'Não definido'}`);
        }

    } catch (error) {
        console.error('❌ Erro geral:', error.response?.data || error.message);
    }
}

configureCorrectDevice();