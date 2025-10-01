require('dotenv').config();
const axios = require('axios');

const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

console.log('🔄 CONECTANDO INSTÂNCIA DO WHATSAPP...\n');

async function connectWhatsAppInstance() {
    try {
        console.log('📋 Configurações:');
        console.log(`URL: ${EVOLUTION_URL}`);
        console.log(`Instance ID: ${EVOLUTION_INSTANCE}`);
        console.log(`Key: ${EVOLUTION_KEY ? '***configurada***' : 'NÃO CONFIGURADA'}\n`);

        // 1. Verificar status atual
        console.log('1️⃣ Verificando status atual da instância...');
        const instancesResponse = await axios.get(
            `${EVOLUTION_URL}/instance/fetchInstances`,
            {
                headers: {
                    'apikey': EVOLUTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const ourInstance = instancesResponse.data.find(inst => inst.id === EVOLUTION_INSTANCE);
        
        if (!ourInstance) {
            console.log('❌ Instância não encontrada!');
            return;
        }

        console.log(`📱 Status atual: ${ourInstance.connectionStatus}`);
        console.log(`👤 Proprietário: ${ourInstance.ownerJid}`);

        // 2. Se está connecting, tentar obter QR Code
        if (ourInstance.connectionStatus === 'connecting') {
            console.log('\n2️⃣ Instância em processo de conexão. Obtendo QR Code...');
            
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
                
                console.log('📱 Resposta da conexão:', JSON.stringify(qrResponse.data, null, 2));
                
                if (qrResponse.data.base64) {
                    console.log('\n🔗 QR CODE DISPONÍVEL!');
                    console.log('📱 Escaneie este QR Code no seu WhatsApp:');
                    console.log('🔗 Base64:', qrResponse.data.base64);
                    console.log('\n📋 INSTRUÇÕES:');
                    console.log('1. Abra o WhatsApp no seu celular');
                    console.log('2. Vá em Configurações > Aparelhos conectados');
                    console.log('3. Toque em "Conectar um aparelho"');
                    console.log('4. Escaneie o QR Code acima');
                } else {
                    console.log('ℹ️  QR Code não disponível. Instância pode já estar conectada.');
                }
                
            } catch (error) {
                console.log('❌ Erro ao obter QR Code:', error.response?.data || error.message);
            }
        }

        // 3. Se está close, tentar reconectar
        else if (ourInstance.connectionStatus === 'close') {
            console.log('\n2️⃣ Instância desconectada. Tentando reconectar...');
            
            try {
                const reconnectResponse = await axios.get(
                    `${EVOLUTION_URL}/instance/connect/${EVOLUTION_INSTANCE}`,
                    {
                        headers: {
                            'apikey': EVOLUTION_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                console.log('🔄 Resposta da reconexão:', JSON.stringify(reconnectResponse.data, null, 2));
                
            } catch (error) {
                console.log('❌ Erro ao reconectar:', error.response?.data || error.message);
            }
        }

        // 4. Se está open, verificar se está funcionando
        else if (ourInstance.connectionStatus === 'open') {
            console.log('\n✅ Instância já está conectada!');
            
            // Verificar se conseguimos obter informações
            try {
                const infoResponse = await axios.get(
                    `${EVOLUTION_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
                    {
                        headers: {
                            'apikey': EVOLUTION_KEY,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                console.log('📊 Estado da conexão:', JSON.stringify(infoResponse.data, null, 2));
                
            } catch (error) {
                console.log('❌ Erro ao verificar estado:', error.response?.data || error.message);
            }
        }

        // 5. Aguardar um pouco e verificar novamente
        console.log('\n3️⃣ Aguardando 5 segundos e verificando status novamente...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const finalCheck = await axios.get(
            `${EVOLUTION_URL}/instance/fetchInstances`,
            {
                headers: {
                    'apikey': EVOLUTION_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const finalInstance = finalCheck.data.find(inst => inst.id === EVOLUTION_INSTANCE);
        if (finalInstance) {
            console.log(`📱 Status final: ${finalInstance.connectionStatus}`);
            
            if (finalInstance.connectionStatus === 'open') {
                console.log('🎉 SUCESSO! Instância conectada com sucesso!');
                console.log(`👤 Proprietário: ${finalInstance.ownerJid}`);
                console.log(`📞 Número: ${finalInstance.number || 'Não definido'}`);
                console.log(`🏷️  Profile: ${finalInstance.profileName || 'Não definido'}`);
            }
        }

    } catch (error) {
        console.error('❌ Erro geral:', error.response?.data || error.message);
    }
}

connectWhatsAppInstance();