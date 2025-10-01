const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTodayMessages() {
  const today = new Date().toISOString().split('T')[0];
  
  console.log('🔍 ANÁLISE MENSAGENS OUTBOUND - HOJE vs ONTEM');
  console.log('='.repeat(50));
  
  // Mensagens de hoje
  const { data: todayMessages, error: todayError } = await supabase
    .from('messages')
    .select('id, tokens_used, billing_status, created_at, message_content')
    .eq('direction', 'outbound')
    .gte('created_at', today + 'T00:00:00.000Z')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (todayError) {
    console.error('❌ Erro ao buscar mensagens de hoje:', todayError);
    return;
  }
  
  console.log('📅 MENSAGENS DE HOJE:');
  console.log('Quantidade:', todayMessages?.length || 0);
  todayMessages?.forEach(msg => {
    console.log(`  ID: ${msg.id}`);
    console.log(`  Tokens: ${msg.tokens_used}`);
    console.log(`  Status: ${msg.billing_status}`);
    console.log(`  Criado: ${msg.created_at}`);
    console.log(`  Conteúdo: ${msg.message_content?.substring(0, 50)}...`);
    console.log('  ---');
  });
  
  // Mensagens de ontem
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const { data: yesterdayMessages, error: yesterdayError } = await supabase
    .from('messages')
    .select('id, tokens_used, billing_status, created_at, message_content')
    .eq('direction', 'outbound')
    .gte('created_at', yesterdayStr + 'T00:00:00.000Z')
    .lt('created_at', today + 'T00:00:00.000Z')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (yesterdayError) {
    console.error('❌ Erro ao buscar mensagens de ontem:', yesterdayError);
    return;
  }
  
  console.log('📅 MENSAGENS DE ONTEM:');
  console.log('Quantidade:', yesterdayMessages?.length || 0);
  yesterdayMessages?.forEach(msg => {
    console.log(`  ID: ${msg.id}`);
    console.log(`  Tokens: ${msg.tokens_used}`);
    console.log(`  Status: ${msg.billing_status}`);
    console.log(`  Criado: ${msg.created_at}`);
    console.log(`  Conteúdo: ${msg.message_content?.substring(0, 50)}...`);
    console.log('  ---');
  });
  
  // Análise comparativa
  console.log('🔍 ANÁLISE COMPARATIVA:');
  const todayWithTokens = todayMessages?.filter(m => m.tokens_used > 0).length || 0;
  const todayCharged = todayMessages?.filter(m => m.billing_status === 'charged').length || 0;
  const yesterdayWithTokens = yesterdayMessages?.filter(m => m.tokens_used > 0).length || 0;
  const yesterdayCharged = yesterdayMessages?.filter(m => m.billing_status === 'charged').length || 0;
  
  console.log(`Hoje - Com tokens: ${todayWithTokens}/${todayMessages?.length || 0}`);
  console.log(`Hoje - Cobradas: ${todayCharged}/${todayMessages?.length || 0}`);
  console.log(`Ontem - Com tokens: ${yesterdayWithTokens}/${yesterdayMessages?.length || 0}`);
  console.log(`Ontem - Cobradas: ${yesterdayCharged}/${yesterdayMessages?.length || 0}`);
}

checkTodayMessages().catch(console.error);