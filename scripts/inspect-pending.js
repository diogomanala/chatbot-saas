// scripts/inspect-pending.js
// Lista "pendentes" suspeitos

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('🔍 Inspecionando mensagens OUTBOUND pendentes...\n');
    
    const { data, error } = await supabase
      .from('messages')
      .select('id,created_at,direction,billing_status,status,tokens_used,phone_number,message_content')
      .eq('direction', 'outbound')
      .eq('billing_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('❌ Erro ao consultar mensagens:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('✅ Nenhuma mensagem OUTBOUND pendente encontrada!');
      return;
    }

    console.log(`⚠️  Encontradas ${data.length} mensagens OUTBOUND pendentes:\n`);
    console.log('Data/Hora              | ID                                   | Used | Bill    | Status  | Telefone     | Conteúdo');
    console.log('─'.repeat(130));

    for (const m of data) {
      const createdAt = new Date(m.created_at).toLocaleString('pt-BR');
      const content = m.message_content ? m.message_content.substring(0, 30) + '...' : 'N/A';
      const phone = m.phone_number || 'N/A';
      
      console.log(
        `${createdAt} | ${m.id} | ${String(m.tokens_used || 0).padStart(4)} | ${m.billing_status.padEnd(7)} | ${m.status.padEnd(7)} | ${phone.padEnd(12)} | ${content}`
      );
    }

    console.log('\n📊 Resumo:');
    const withTokensUsed = data.filter(m => (m.tokens_used || 0) > 0).length;
    const withoutTokensUsed = data.filter(m => (m.tokens_used || 0) === 0).length;
    
    console.log(`   • Com tokens_used > 0: ${withTokensUsed}`);
    console.log(`   • Com tokens_used = 0: ${withoutTokensUsed}`);
    
    if (withTokensUsed > 0) {
      console.log('\n⚠️  ATENÇÃO: Mensagens pendentes com tokens_used > 0 indicam problema no fluxo de débito!');
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
})();