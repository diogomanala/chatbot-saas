const axios = require('axios');

const EVOLUTION_BASE_URL = 'https://evolution-api-evolution-api.audihb.easypanel.host';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

async function debugInstances() {
    try {
        console.log('🔍 Debugando instâncias da Evolution API...\n');
        
        // 1. Listar todas as instâncias
        console.log('1️⃣ Listando todas as instâncias...');
        const instancesResponse = await axios.get(
            `${EVOLUTION_BASE_URL}/instance/fetchInstances`,
            {
                headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Estrutura completa das instâncias:');
        console.log(JSON.stringify(instancesResponse.data, null, 2));
        
        // 2. Tentar diferentes endpoints para cada instância
        console.log('\n2️⃣ Testando endpoints para cada instância...');
        
        for (const inst of instancesResponse.data) {
            const instanceName = inst.name || inst.instanceName;
            const instanceId = inst.id || inst.instanceId;
            
            console.log(`\n--- Testando instância: ${instanceName} (ID: ${instanceId}) ---`);
            
            // Testar com nome
            if (instanceName) {
                try {
                    console.log(`Testando webhook com nome: ${instanceName}`);
                    const webhookTestName = await axios.get(
                        `${EVOLUTION_BASE_URL}/webhook/find/${instanceName}`,
                        {
                            headers: {
                                'apikey': EVOLUTION_API_KEY,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    console.log('✅ Webhook encontrado com nome:', webhookTestName.data);
                } catch (error) {
                    console.log('❌ Erro com nome:', error.response?.status, error.response?.data?.response?.message);
                }
            }
            
            // Testar com ID
            if (instanceId) {
                try {
                    console.log(`Testando webhook com ID: ${instanceId}`);
                    const webhookTestId = await axios.get(
                        `${EVOLUTION_BASE_URL}/webhook/find/${instanceId}`,
                        {
                            headers: {
                                'apikey': EVOLUTION_API_KEY,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    console.log('✅ Webhook encontrado com ID:', webhookTestId.data);
                } catch (error) {
                    console.log('❌ Erro com ID:', error.response?.status, error.response?.data?.response?.message);
                }
            }
            
            // Testar status da conexão com nome
            if (instanceName) {
                try {
                    console.log(`Testando conexão com nome: ${instanceName}`);
                    const connectionTestName = await axios.get(
                        `${EVOLUTION_BASE_URL}/instance/connectionState/${instanceName}`,
                        {
                            headers: {
                                'apikey': EVOLUTION_API_KEY,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    console.log('✅ Conexão encontrada com nome:', connectionTestName.data);
                } catch (error) {
                    console.log('❌ Erro conexão com nome:', error.response?.status, error.response?.data?.response?.message);
                }
            }
            
            // Testar status da conexão com ID
            if (instanceId) {
                try {
                    console.log(`Testando conexão com ID: ${instanceId}`);
                    const connectionTestId = await axios.get(
                        `${EVOLUTION_BASE_URL}/instance/connectionState/${instanceId}`,
                        {
                            headers: {
                                'apikey': EVOLUTION_API_KEY,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    console.log('✅ Conexão encontrada com ID:', connectionTestId.data);
                } catch (error) {
                    console.log('❌ Erro conexão com ID:', error.response?.status, error.response?.data?.response?.message);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Erro geral:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Dados:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debugInstances();