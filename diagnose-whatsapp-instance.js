require('dotenv').config();
const axios = require('axios');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

console.log('🔍 DIAGNÓSTICO COMPLETO DA INSTÂNCIA DO WHATSAPP...\n');

async function diagnoseWhatsAppInstance() {
    try {
        console.log('📋 Configurações:');
        console.log(`URL: ${EVOLUTION_URL}`);
        console.log(`Instance ID: ${EVOLUTION_INSTANCE}`);
        console.log(`Key: ${EVOLUTION_KEY ? '***configurada***' : 'NÃO CONFIGURADA'}\n`);

        // 1. Listar todas as instâncias
        console.log('1️⃣ Listando todas as instâncias disponíveis...');
        const instancesResponse = await axios.get(
            `${EVOLUTION_URL}/instance/fetchInstances`,
            {
                headers: {
                    'apikey': EVOLUTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const instances = instancesResponse.data;
        console.log(`📊 Total de instâncias encontradas: ${instances.length}\n`);

        // Verificar se nossa instância existe
        const ourInstance = instances.find(inst => inst.id === EVOLUTION_INSTANCE);
        
        if (ourInstance) {
            console.log('✅ Nossa instância foi encontrada!');
            console.log(`📱 Nome: ${ourInstance.name}`);
            console.log(`🔗 Status: ${ourInstance.connectionStatus}`);
            console.log(`👤 Proprietário: ${ourInstance.ownerJid}`);
            console.log(`📞 Número: ${ourInstance.number || 'Não definido'}`);
            console.log(`🏷️  Profile: ${ourInstance.profileName || 'Não definido'}`);
            
            if (ourInstance.connectionStatus === 'close') {
                console.log('❌ PROBLEMA: Instância está desconectada!');
                console.log(`🔍 Código de desconexão: ${ourInstance.disconnectionReasonCode}`);
                console.log(`📅 Desconectada em: ${ourInstance.disconnectionAt}`);
                
                if (ourInstance.disconnectionObject) {
                    try {
                        const disconnectionInfo = JSON.parse(ourInstance.disconnectionObject);
                        console.log('📋 Detalhes da desconexão:', JSON.stringify(disconnectionInfo, null, 2));
                    } catch (e) {
                        console.log('📋 Objeto de desconexão:', ourInstance.disconnectionObject);
                    }
                }
            }
        } else {
            console.log('❌ PROBLEMA: Nossa instância não foi encontrada na lista!');
            console.log('\n📋 Instâncias disponíveis:');
            instances.forEach((inst, index) => {
                console.log(`${index + 1}. ID: ${inst.id}`);
                console.log(`   Nome: ${inst.name}`);
                console.log(`   Status: ${inst.connectionStatus}`);
                console.log(`   Número: ${inst.number || 'N/A'}\n`);
            });
        }

        // 2. Tentar conectar/reconectar a instância
        if (ourInstance && ourInstance.connectionStatus === 'close') {
            console.log('\n2️⃣ Tentando reconectar a instância...');
            try {
                const connectResponse = await axios.get(
                    `${EVOLUTION_URL}/instance/connect/${EVOLUTION_INSTANCE}`,
                    {
                        headers: {
                            'apikey': EVOLUTION_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                console.log('🔄 Resposta da reconexão:', JSON.stringify(connectResponse.data, null, 2));
            } catch (error) {
                console.log('❌ Erro ao tentar reconectar:', error.response?.data || error.message);
            }
        }

        // 3. Verificar configuração do webhook
        console.log('\n3️⃣ Verificando configuração atual do webhook...');
        try {
            const webhookResponse = await axios.get(
                `${EVOLUTION_URL}/webhook/find/${EVOLUTION_INSTANCE}`,
                {
                    headers: {
                        'apikey': EVOLUTION_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('🔗 Webhook atual:', JSON.stringify(webhookResponse.data, null, 2));
        } catch (error) {
            console.log('❌ Erro ao verificar webhook:', error.response?.data || error.message);
        }

        // 4. Verificar se conseguimos obter o QR Code (se necessário)
        if (ourInstance && ourInstance.connectionStatus === 'close') {
            console.log('\n4️⃣ Tentando obter QR Code para reconexão...');
            try {
                const qrResponse = await axios.get(
                    `${EVOLUTION_URL}/instance/connect/${EVOLUTION_INSTANCE}`,
                    {
                        headers: {
                            'apikey': EVOLUTION_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                if (qrResponse.data.base64) {
                    console.log('📱 QR Code disponível! Você precisa escanear o QR Code no WhatsApp.');
                    console.log('🔗 Base64 do QR Code:', qrResponse.data.base64.substring(0, 100) + '...');
                } else {
                    console.log('ℹ️  QR Code não disponível no momento.');
                }
            } catch (error) {
                console.log('❌ Erro ao obter QR Code:', error.response?.data || error.message);
            }
        }

    } catch (error) {
        console.error('❌ Erro geral no diagnóstico:', error.response?.data || error.message);
    }
}

diagnoseWhatsAppInstance();