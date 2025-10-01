// scripts/check-latest-outbound.js
// Assegura que últimas OUTBOUND estão debited e tokens_used>0

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    console.log('🔍 Verificando últimas mensagens OUTBOUND...\n');
    
    const { data, error } = await supabase
      .from('messages')
      .select('id,created_at,direction,billing_status,status,tokens_used,phone_number,message_content')
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erro ao consultar mensagens:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('ℹ️  Nenhuma mensagem OUTBOUND encontrada.');
      return;
    }

    console.log(`📊 Últimas ${data.length} mensagens OUTBOUND:\n`);
    console.log('Data/Hora              | ID                                   | Used | Bill    | Status  | Telefone     | Conteúdo');
    console.log('─'.repeat(130));

    let problemsFound = 0;
    
    for (const m of data) {
      const createdAt = new Date(m.created_at).toLocaleString('pt-BR');
      const content = m.message_content ? m.message_content.substring(0, 30) + '...' : 'N/A';
      const phone = m.phone_number || 'N/A';
      
      // Verificar problemas
      const hasTokens = m.tokens_used > 0;
      const isDebited = m.billing_status === 'debited';
      const isProblematic = !hasTokens || !isDebited;
      
      if (isProblematic) problemsFound++;
      
      const marker = isProblematic ? '❌' : '✅';
      
      console.log(
        `${createdAt} | ${m.id} | ${String(m.tokens_used || 0).padStart(4)} | ${m.billing_status.padEnd(7)} | ${m.status.padEnd(7)} | ${phone.padEnd(12)} | ${content} ${marker}`
      );
    }

    console.log('\n📈 RESUMO:');
    console.log(`✅ Mensagens corretas: ${data.length - problemsFound}`);
    console.log(`❌ Mensagens com problemas: ${problemsFound}`);
    
    if (problemsFound > 0) {
      console.log('\n⚠️  PROBLEMAS ENCONTRADOS:');
      console.log('- Mensagens com tokens_used = 0 (não foram processadas corretamente)');
      console.log('- Mensagens com billing_status != "debited" (não foram cobradas)');
      console.log('\n💡 RECOMENDAÇÕES:');
      console.log('1. Verificar se o serviço de auto-débito está funcionando');
      console.log('2. Verificar se o processamento de IA está retornando tokens');
      console.log('3. Executar: node scripts/inspect-pending.js');
    } else {
      console.log('\n🎉 Todas as mensagens estão corretas!');
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
})();