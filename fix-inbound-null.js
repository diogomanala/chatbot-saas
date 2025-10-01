require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixInboundNull() {
  console.log('🔧 Corrigindo mensagem inbound com billing_status null\n');

  try {
    const messageId = '48953215-f71c-4345-8fb7-1085e12aaf28';

    // 1. Verificar a mensagem atual
    console.log('🔍 Verificando mensagem atual...');
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar mensagem:', fetchError);
      return;
    }

    if (!message) {
      console.log('❌ Mensagem não encontrada');
      return;
    }

    console.log(`📄 Mensagem encontrada:`);
    console.log(`   ID: ${message.id}`);
    console.log(`   Direção: ${message.direction}`);
    console.log(`   Status atual: ${message.billing_status}`);
    console.log(`   Criada em: ${message.created_at}`);
    console.log(`   Conteúdo: ${message.message_content?.substring(0, 50)}...`);

    // 2. Verificar se é realmente inbound
    if (message.direction !== 'inbound') {
      console.log('❌ Esta mensagem não é inbound, não deve ser corrigida aqui');
      return;
    }

    // 3. Corrigir o billing_status para 'skipped'
    console.log('\n🔧 Corrigindo billing_status...');
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        billing_status: 'skipped' // Mensagens inbound não são cobradas
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('❌ Erro ao atualizar mensagem:', updateError);
      return;
    }

    console.log('✅ Mensagem corrigida com sucesso!');
    console.log('   billing_status: null → "skipped"');

    // 4. Verificar o resultado
    console.log('\n🔍 Verificando resultado...');
    const { data: updatedMessage, error: verifyError } = await supabase
      .from('messages')
      .select('id, direction, billing_status, created_at')
      .eq('id', messageId)
      .single();

    if (verifyError) {
      console.error('❌ Erro ao verificar resultado:', verifyError);
      return;
    }

    console.log(`📄 Mensagem após correção:`);
    console.log(`   ID: ${updatedMessage.id}`);
    console.log(`   Direção: ${updatedMessage.direction}`);
    console.log(`   Status: ${updatedMessage.billing_status}`);
    console.log(`   Criada em: ${updatedMessage.created_at}`);

    console.log('\n🎯 Correção concluída com sucesso! ✅');

  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
  }
}

// Executar a correção
fixInboundNull().then(() => {
  console.log('\n🏁 Script de correção finalizado');
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});