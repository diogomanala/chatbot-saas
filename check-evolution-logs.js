require('dotenv').config();
const axios = require('axios');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

console.log('🔍 VERIFICANDO LOGS DA EVOLUTION API...\n');

async function checkEvolutionLogs() {
    try {
        console.log('📋 Configurações:');
        console.log(`URL: ${EVOLUTION_URL}`);
        console.log(`Instance: ${EVOLUTION_INSTANCE}`);
        console.log(`Key: ${EVOLUTION_KEY ? '***configurada***' : 'NÃO CONFIGURADA'}\n`);

        // 1. Verificar status da instância
        console.log('1️⃣ Verificando status da instância...');
        const statusResponse = await axios.get(
            `${EVOLUTION_URL}/instance/fetchInstances`,
            {
                headers: {
                    'apikey': EVOLUTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Status das instâncias:', JSON.stringify(statusResponse.data, null, 2));

        // 2. Verificar conexão específica da instância
        console.log('\n2️⃣ Verificando conexão da instância específica...');
        try {
            const connectionResponse = await axios.get(
                `${EVOLUTION_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
                {
                    headers: {
                        'apikey': EVOLUTION_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Estado da conexão:', JSON.stringify(connectionResponse.data, null, 2));
        } catch (error) {
            console.log('❌ Erro ao verificar conexão:', error.response?.data || error.message);
        }

        // 3. Verificar webhook atual
        console.log('\n3️⃣ Verificando configuração do webhook...');
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
            console.log('Configuração do webhook:', JSON.stringify(webhookResponse.data, null, 2));
        } catch (error) {
            console.log('❌ Erro ao verificar webhook:', error.response?.data || error.message);
        }

        // 4. Tentar obter informações da instância
        console.log('\n4️⃣ Obtendo informações detalhadas da instância...');
        try {
            const instanceResponse = await axios.get(
                `${EVOLUTION_URL}/instance/connect/${EVOLUTION_INSTANCE}`,
                {
                    headers: {
                        'apikey': EVOLUTION_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log('Informações da instância:', JSON.stringify(instanceResponse.data, null, 2));
        } catch (error) {
            console.log('❌ Erro ao obter informações:', error.response?.data || error.message);
        }

    } catch (error) {
        console.error('❌ Erro geral:', error.response?.data || error.message);
    }
}

checkEvolutionLogs();