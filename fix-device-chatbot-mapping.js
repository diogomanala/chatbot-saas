/**
 * Script para corrigir o mapeamento do dispositivo para o chatbot correto
 * 
 * Problema: O dispositivo 'medical-crm-...' está associado ao chatbot errado
 * Solução: Atualizar o chatbot_id do dispositivo para o chatbot correto
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase Admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// IDs identificados na depuração
const DEVICE_ID = '9d166619-e7cf-4f5e-9637-65c6f4d2481f';
const CORRECT_CHATBOT_ID = 'f99ae725-f996-483d-8813-cde922d8877a';
const WRONG_CHATBOT_ID = '761a8b2e-4c5d-4e8f-9a1b-2c3d4e5f6789'; // Para referência

async function fixDeviceChatbotMapping() {
  console.log('🔧 Iniciando correção do mapeamento dispositivo-chatbot...\n');

  try {
    // 1. Verificar estado atual do dispositivo
    console.log('1️⃣ Verificando estado atual do dispositivo...');
    const { data: currentDevice, error: selectError } = await supabaseAdmin
      .from('devices')
      .select(`
        id,
        name,
        chatbot_id,
        chatbots!devices_chatbot_id_fkey (
          id,
          name
        )
      `)
      .eq('id', DEVICE_ID)
      .single();

    if (selectError) {
      console.error('❌ Erro ao buscar dispositivo:', selectError);
      return;
    }

    if (!currentDevice) {
      console.error('❌ Dispositivo não encontrado');
      return;
    }

    console.log('📱 Dispositivo atual:');
    console.log(`   ID: ${currentDevice.id}`);
    console.log(`   Nome: ${currentDevice.name}`);
    console.log(`   Chatbot ID atual: ${currentDevice.chatbot_id}`);
    console.log(`   Chatbot nome: ${currentDevice.chatbots?.name || 'N/A'}`);
    console.log('');

    // 2. Verificar se já está correto
    if (currentDevice.chatbot_id === CORRECT_CHATBOT_ID) {
      console.log('✅ O dispositivo já está associado ao chatbot correto!');
      return;
    }

    // 3. Verificar se o chatbot correto existe
    console.log('2️⃣ Verificando se o chatbot correto existe...');
    const { data: correctChatbot, error: chatbotError } = await supabaseAdmin
      .from('chatbots')
      .select('id, name, is_active')
      .eq('id', CORRECT_CHATBOT_ID)
      .single();

    if (chatbotError || !correctChatbot) {
      console.error('❌ Chatbot correto não encontrado:', chatbotError);
      return;
    }

    console.log('🤖 Chatbot correto encontrado:');
    console.log(`   ID: ${correctChatbot.id}`);
    console.log(`   Nome: ${correctChatbot.name}`);
    console.log(`   Ativo: ${correctChatbot.is_active}`);
    console.log('');

    // 4. Executar a atualização
    console.log('3️⃣ Executando atualização do mapeamento...');
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('devices')
      .update({ 
        chatbot_id: CORRECT_CHATBOT_ID,
        updated_at: new Date().toISOString()
      })
      .eq('id', DEVICE_ID)
      .select();

    if (updateError) {
      console.error('❌ Erro ao atualizar dispositivo:', updateError);
      return;
    }

    console.log('✅ Atualização executada com sucesso!');
    console.log('');

    // 5. Verificar o resultado final
    console.log('4️⃣ Verificando resultado final...');
    const { data: updatedDevice, error: finalSelectError } = await supabaseAdmin
      .from('devices')
      .select(`
        id,
        name,
        chatbot_id,
        updated_at,
        chatbots!devices_chatbot_id_fkey (
          id,
          name,
          is_active
        )
      `)
      .eq('id', DEVICE_ID)
      .single();

    if (finalSelectError) {
      console.error('❌ Erro ao verificar resultado:', finalSelectError);
      return;
    }

    console.log('📱 Estado final do dispositivo:');
    console.log(`   ID: ${updatedDevice.id}`);
    console.log(`   Nome: ${updatedDevice.name}`);
    console.log(`   Chatbot ID: ${updatedDevice.chatbot_id}`);
    console.log(`   Chatbot nome: ${updatedDevice.chatbots?.name || 'N/A'}`);
    console.log(`   Chatbot ativo: ${updatedDevice.chatbots?.is_active || 'N/A'}`);
    console.log(`   Atualizado em: ${updatedDevice.updated_at}`);
    console.log('');

    // 6. Confirmação final
    if (updatedDevice.chatbot_id === CORRECT_CHATBOT_ID) {
      console.log('🎉 SUCESSO! O dispositivo foi associado ao chatbot correto.');
      console.log('');
      console.log('📋 Resumo da correção:');
      console.log(`   Dispositivo: ${updatedDevice.name}`);
      console.log(`   Chatbot anterior: ${currentDevice.chatbots?.name || 'Desconhecido'}`);
      console.log(`   Chatbot atual: ${updatedDevice.chatbots?.name}`);
      console.log('');
      console.log('✅ O sistema agora deve funcionar corretamente!');
    } else {
      console.log('❌ ERRO: A atualização não foi aplicada corretamente.');
    }

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

// Executar o script
fixDeviceChatbotMapping()
  .then(() => {
    console.log('\n🏁 Script finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });