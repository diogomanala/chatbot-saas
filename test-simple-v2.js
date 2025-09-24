require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSimpleV2() {
  console.log('=== TESTE DO SISTEMA DE COBRANÇA SIMPLIFICADO V2 ===\n');
  
  const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
  
  try {
    // 1. Verificar mensagens disponíveis
    console.log('1. Verificando mensagens disponíveis...');
    const { data: allMessages, error: allMessagesError } = await supabase
      .from('messages')
      .select('id, content, direction, billing_status, charged_at, tokens_used')
      .eq('org_id', orgId)
      .limit(10);
      
    if (allMessagesError) {
      console.error('Erro ao buscar mensagens:', allMessagesError);
      return;
    }
    
    console.log(`Total de mensagens: ${allMessages?.length || 0}`);
    
    const pendingMessages = allMessages?.filter(m => !m.billing_status || m.billing_status !== 'charged') || [];
    const chargedMessages = allMessages?.filter(m => m.billing_status === 'charged') || [];
    
    console.log(`Mensagens pendentes: ${pendingMessages.length}`);
    console.log(`Mensagens já cobradas: ${chargedMessages.length}`);
    
    if (pendingMessages.length > 0) {
      console.log('\nPrimeiras mensagens pendentes:');
      pendingMessages.slice(0, 3).forEach((msg, i) => {
        console.log(`${i + 1}. ID: ${msg.id}, Status: ${msg.billing_status || 'null'}, Conteúdo: "${(msg.content || '').substring(0, 50)}..."`);
      });
    }
    
    // 2. Verificar saldo atual
    console.log('\n2. Verificando saldo atual...');
    const { data: wallet, error: walletError } = await supabase
      .from('credit_wallets')
      .select('id, balance, org_id')
      .eq('org_id', orgId)
      .single();
      
    if (walletError) {
      console.error('Erro ao buscar carteira:', walletError);
      return;
    }
    
    console.log(`Saldo atual: ${wallet.balance} créditos`);
    console.log(`ID da carteira: ${wallet.id}`);
    
    // 3. Testar o novo endpoint
    console.log('\n3. Testando endpoint simplificado V2...');
    const response = await fetch('http://localhost:3000/api/billing/simple-v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ org_id: orgId })
    });
    
    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Resultado:', JSON.stringify(result, null, 2));
    
    // 4. Verificar mudanças após processamento
    if (response.ok && result.success) {
      console.log('\n4. Verificando mudanças após processamento...');
      
      // Verificar novo saldo
      const { data: newWallet } = await supabase
        .from('credit_wallets')
        .select('balance')
        .eq('org_id', orgId)
        .single();
        
      console.log(`Novo saldo: ${newWallet?.balance || 'N/A'} créditos`);
      
      // Verificar mensagens marcadas como cobradas
      const { data: updatedMessages } = await supabase
        .from('messages')
        .select('id, billing_status, charged_at, tokens_used')
        .eq('org_id', orgId)
        .eq('billing_status', 'charged')
        .order('charged_at', { ascending: false })
        .limit(5);
        
      console.log(`Mensagens recém-cobradas: ${updatedMessages?.length || 0}`);
      if (updatedMessages && updatedMessages.length > 0) {
        updatedMessages.forEach((msg, i) => {
          console.log(`${i + 1}. ID: ${msg.id}, Tokens: ${msg.tokens_used || 0}, Cobrada em: ${msg.charged_at}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Erro no teste:', error);
  }
  
  console.log('\n=== TESTE CONCLUÍDO ===');
}

testSimpleV2().catch(console.error);