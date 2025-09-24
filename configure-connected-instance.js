require('dotenv').config();
const axios = require('axios');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

async function configureConnectedInstance() {
    console.log('🔧 Configurando webhook para a instância conectada...');
    console.log(`Instance: ${EVOLUTION_INSTANCE}`);
    
    try {
        // 1. Verificar se a instância existe e está conectada
        console.log('\n📋 Verificando status da instância...');
        const instanceResponse = await axios.get(
            `${EVOLUTION_API_URL}/instance/fetchInstances`,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY
                }
            }
        );
        
        const instances = instanceResponse.data;
        console.log('Estrutura da resposta:', JSON.stringify(instances, null, 2));
        
        // Tentar diferentes estruturas de dados
        let targetInstance = null;
        
        if (Array.isArray(instances)) {
            targetInstance = instances.find(inst => {
                // A estrutura é: inst.name, inst.id, inst.connectionStatus
                return inst.name === EVOLUTION_INSTANCE || inst.id === EVOLUTION_INSTANCE;
            });
        }
        
        if (!targetInstance) {
            console.log('❌ Instância não encontrada!');
            console.log('Instâncias disponíveis:');
            if (Array.isArray(instances)) {
                instances.forEach(inst => {
                    console.log(`- Nome: ${inst.name}, ID: ${inst.id}, Status: ${inst.connectionStatus}`);
                });
            } else {
                console.log('Estrutura inesperada:', instances);
            }
            return;
        }
        
        const instanceName = targetInstance.name;
        const status = targetInstance.connectionStatus;
        
        console.log(`✅ Instância encontrada: ${instanceName}`);
        console.log(`Status: ${status}`);
        
        // 2. Configurar webhook
        console.log('\n🔗 Configurando webhook...');
        const webhookConfig = {
            url: 'https://saas-chatbot-production.vercel.app/api/webhook/evolution',
            enabled: true,
            events: [
                'MESSAGES_UPSERT',
                'CONNECTION_UPDATE'
            ]
        };
        
        const webhookResponse = await axios.post(
            `${EVOLUTION_API_URL}/webhook/set/${EVOLUTION_INSTANCE}`,
            webhookConfig,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Webhook configurado com sucesso!');
        console.log('Configuração:', JSON.stringify(webhookConfig, null, 2));
        
        // 3. Verificar configuração do webhook
        console.log('\n🔍 Verificando configuração do webhook...');
        const checkWebhookResponse = await axios.get(
            `${EVOLUTION_API_URL}/webhook/find/${EVOLUTION_INSTANCE}`,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY
                }
            }
        );
        
        console.log('Webhook atual:', JSON.stringify(checkWebhookResponse.data, null, 2));
        
        // 4. Se a instância estiver conectada, tentar enviar uma mensagem de teste
        if (status === 'open') {
            console.log('\n📱 Instância está conectada! Tentando enviar mensagem de teste...');
            
            // Primeiro, vamos tentar obter informações da instância
            try {
                const instanceInfoResponse = await axios.get(
                    `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
                    {
                        headers: {
                            'apikey': EVOLUTION_API_KEY
                        }
                    }
                );
                
                console.log('Estado da conexão:', JSON.stringify(instanceInfoResponse.data, null, 2));
                
            } catch (error) {
                console.log('⚠️ Não foi possível obter estado da conexão:', error.response?.data || error.message);
            }
        }
        
        console.log('\n🎉 Configuração concluída com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao configurar instância:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
            console.log('\n💡 Dica: A instância pode não existir ou o nome/ID pode estar incorreto.');
            console.log('Verifique se o EVOLUTION_INSTANCE no .env está correto.');
        }
    }
}

configureConnectedInstance();