require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function verifyCorrectMapping() {
    console.log('🔍 Verificando mapeamento org_id -> chatbot_id (CORRIGIDO)...\n');
    
    // Credenciais fornecidas pelo usuário
    const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
    const expectedChatbotId = 'f99ae725-f996-483d-8813-cde922d8877a';
    
    console.log('📋 Credenciais a verificar:');
    console.log(`   🏢 Org ID: ${orgId}`);
    console.log(`   🤖 Expected Chatbot ID: ${expectedChatbotId}\n`);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.log('❌ Credenciais do Supabase não encontradas');
        return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        // 1. Verificar se a organização existe
        console.log('🏢 1. Verificando organização...');
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();
        
        if (orgError) {
            console.log(`   ❌ Erro ao buscar organização: ${orgError.message}`);
            return;
        }
        
        if (!org) {
            console.log('   ❌ Organização não encontrada');
            return;
        }
        
        console.log(`   ✅ Organização encontrada: ${org.name}`);
        console.log(`   📅 Criada em: ${new Date(org.created_at).toLocaleString()}\n`);
        
        // 2. Verificar se o chatbot existe
        console.log('🤖 2. Verificando chatbot...');
        const { data: chatbot, error: chatbotError } = await supabase
            .from('chatbots')
            .select('*')
            .eq('id', expectedChatbotId)
            .single();
        
        if (chatbotError) {
            console.log(`   ❌ Erro ao buscar chatbot: ${chatbotError.message}`);
            return;
        }
        
        if (!chatbot) {
            console.log('   ❌ Chatbot não encontrado');
            return;
        }
        
        console.log(`   ✅ Chatbot encontrado: ${chatbot.name}`);
        console.log(`   🏢 Org ID do chatbot: ${chatbot.org_id}`);
        console.log(`   📅 Criado em: ${new Date(chatbot.created_at).toLocaleString()}`);
        console.log(`   🔧 Ativo: ${chatbot.is_active ? 'Sim' : 'Não'}\n`);
        
        // 3. Verificar se o mapeamento está correto
        console.log('🔗 3. Verificando mapeamento...');
        if (chatbot.org_id === orgId) {
            console.log('   ✅ Mapeamento correto! Chatbot pertence à organização');
        } else {
            console.log(`   ❌ Mapeamento incorreto!`);
            console.log(`      Esperado: ${orgId}`);
            console.log(`      Encontrado: ${chatbot.org_id}`);
        }
        
        // 4. Buscar todos os chatbots da organização
        console.log('\n🤖 4. Listando todos os chatbots da organização...');
        const { data: allChatbots, error: allChatbotsError } = await supabase
            .from('chatbots')
            .select('id, name, is_active, created_at')
            .eq('org_id', orgId);
        
        if (allChatbotsError) {
            console.log(`   ❌ Erro ao buscar chatbots: ${allChatbotsError.message}`);
        } else if (allChatbots && allChatbots.length > 0) {
            console.log(`   ✅ ${allChatbots.length} chatbot(s) encontrado(s):`);
            allChatbots.forEach((bot, index) => {
                const isExpected = bot.id === expectedChatbotId ? ' ⭐ (ESPERADO)' : '';
                const status = bot.is_active ? '🟢' : '🔴';
                console.log(`      ${index + 1}. ${status} ${bot.name} (${bot.id})${isExpected}`);
                console.log(`         📅 Criado: ${new Date(bot.created_at).toLocaleString()}`);
            });
        } else {
            console.log('   ⚠️  Nenhum chatbot encontrado para esta organização');
        }
        
        // 5. Verificar dispositivos conectados
        console.log('\n📱 5. Verificando dispositivos conectados...');
        const { data: devices, error: devicesError } = await supabase
            .from('devices')
            .select('*')
            .eq('org_id', orgId);
        
        if (devicesError) {
            console.log(`   ❌ Erro ao buscar dispositivos: ${devicesError.message}`);
        } else if (devices && devices.length > 0) {
            console.log(`   ✅ ${devices.length} dispositivo(s) encontrado(s):`);
            devices.forEach((device, index) => {
                const status = device.status === 'connected' ? '🟢 Conectado' : '🔴 Desconectado';
                console.log(`      ${index + 1}. ${status} - ${device.name || device.instance_id}`);
                console.log(`         🆔 Instance: ${device.instance_id}`);
                console.log(`         🤖 Chatbot: ${device.chatbot_id}`);
                console.log(`         📅 Última conexão: ${device.last_connection ? new Date(device.last_connection).toLocaleString() : 'N/A'}`);
            });
        } else {
            console.log('   ⚠️  Nenhum dispositivo encontrado para esta organização');
        }
        
        // 6. Verificar mensagens recentes
        console.log('\n📬 6. Verificando mensagens recentes...');
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (messagesError) {
            console.log(`   ❌ Erro ao buscar mensagens: ${messagesError.message}`);
        } else if (messages && messages.length > 0) {
            console.log(`   ✅ ${messages.length} mensagem(ns) recente(s):`);
            messages.forEach((msg, index) => {
                const direction = msg.direction === 'inbound' ? '📥 Recebida' : '📤 Enviada';
                const timestamp = new Date(msg.created_at).toLocaleString();
                const content = msg.message_content ? msg.message_content.substring(0, 50) + '...' : 'N/A';
                console.log(`      ${index + 1}. ${direction} [${timestamp}]`);
                console.log(`         💬 ${content}`);
                console.log(`         🤖 Chatbot: ${msg.chatbot_id}`);
                console.log(`         📱 Device: ${msg.device_id}`);
                console.log(`         📞 Phone: ${msg.phone_number}`);
            });
        } else {
            console.log('   ⚠️  Nenhuma mensagem encontrada para esta organização');
        }
        
        // 7. Verificar se existe dispositivo com a instância específica
        console.log('\n🔍 7. Verificando instância específica...');
        const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
        const { data: specificDevice, error: specificDeviceError } = await supabase
            .from('devices')
            .select('*')
            .eq('instance_id', instanceName)
            .single();
        
        if (specificDeviceError) {
            console.log(`   ❌ Dispositivo com instância ${instanceName} não encontrado`);
            console.log(`   💡 Isso pode explicar por que as mensagens não chegam!`);
        } else {
            console.log(`   ✅ Dispositivo encontrado para instância ${instanceName}:`);
            console.log(`      📱 Nome: ${specificDevice.name}`);
            console.log(`      🏢 Org ID: ${specificDevice.org_id}`);
            console.log(`      🤖 Chatbot ID: ${specificDevice.chatbot_id}`);
            console.log(`      🔗 Status: ${specificDevice.status}`);
            
            if (specificDevice.org_id !== orgId) {
                console.log(`   ❌ PROBLEMA: Dispositivo pertence a org diferente!`);
                console.log(`      Esperado: ${orgId}`);
                console.log(`      Encontrado: ${specificDevice.org_id}`);
            }
            
            if (specificDevice.chatbot_id !== expectedChatbotId) {
                console.log(`   ❌ PROBLEMA: Dispositivo conectado a chatbot diferente!`);
                console.log(`      Esperado: ${expectedChatbotId}`);
                console.log(`      Encontrado: ${specificDevice.chatbot_id}`);
            }
        }
        
        console.log('\n📋 DIAGNÓSTICO FINAL:');
        console.log('='.repeat(50));
        
        if (org && chatbot && chatbot.org_id === orgId) {
            console.log('✅ Mapeamento org_id -> chatbot_id está correto');
            
            if (chatbot.is_active) {
                console.log('✅ Chatbot está ativo');
                
                if (devices && devices.some(d => d.status === 'connected')) {
                    console.log('✅ Pelo menos um dispositivo está conectado');
                    
                    if (specificDevice && specificDevice.org_id === orgId && specificDevice.chatbot_id === expectedChatbotId) {
                        console.log('✅ Instância específica está corretamente configurada');
                        console.log('\n💡 CONFIGURAÇÃO PERFEITA!');
                        console.log('🔧 Se ainda não está recebendo mensagens:');
                        console.log('   1. Verifique se o webhook está configurado na Evolution API');
                        console.log('   2. Teste enviando uma mensagem real');
                        console.log('   3. Verifique os logs do Vercel');
                    } else {
                        console.log('❌ Problema na configuração da instância específica');
                    }
                } else {
                    console.log('❌ Nenhum dispositivo conectado');
                }
            } else {
                console.log('❌ Chatbot está inativo');
            }
        } else {
            console.log('❌ Problema no mapeamento ou configuração');
        }
        
    } catch (error) {
        console.log(`❌ Erro geral: ${error.message}`);
    }
}

verifyCorrectMapping().catch(console.error);