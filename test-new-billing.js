require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testNewBilling() {
  console.log('=== TESTE DO NOVO SISTEMA DE COBRANÇA ===\n');
  
  const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
  
  try {
    // 1. Verificar se as novas tabelas existem
    console.log('1. Verificando estrutura das novas tabelas...');
    
    const { error: billingError } = await supabase
      .from('message_billing')
      .select('*')
      .limit(1);
      
    const { error: creditsError } = await supabase
      .from('organization_credits')
      .select('*')
      .limit(1);
    
    if (billingError) {
      console.log('❌ Tabela message_billing não existe ainda');
      console.log('Execute o SQL primeiro: psql -d sua_database -f create-billing-table.sql');
      return;
    }
    
    if (creditsError) {
      console.log('❌ Tabela organization_credits não existe ainda');
      console.log('Execute o SQL primeiro: psql -d sua_database -f create-billing-table.sql');
      return;
    }
    
    console.log('✅ Tabelas existem');
    
    // 2. Verificar mensagens disponíveis
    console.log('\n2. Verificando mensagens disponíveis...');
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, direction, org_id')
      .eq('org_id', orgId)
      .limit(5);
      
    if (messagesError) {
      console.error('Erro ao buscar mensagens:', messagesError);
      return;
    }
    
    console.log(`Encontradas ${messages?.length || 0} mensagens para a organização`);
    if (messages && messages.length > 0) {
      messages.forEach((msg, i) => {
        console.log(`${i + 1}. ID: ${msg.id}, Direção: ${msg.direction}, Conteúdo: "${(msg.content || '').substring(0, 50)}..."`); 
      });
    }
    
    // 3. Verificar saldo atual
    console.log('\n3. Verificando saldo atual...');
    const { data: currentCredits } = await supabase
      .from('organization_credits')
      .select('*')
      .eq('org_id', orgId)
      .single();
      
    if (currentCredits) {
      console.log(`Saldo atual: ${currentCredits.balance} créditos`);
    } else {
      console.log('Nenhum saldo encontrado (será criado automaticamente)');
    }
    
    // 4. Testar o novo endpoint
    console.log('\n4. Testando novo endpoint de cobrança...');
    const response = await fetch('http://localhost:3000/api/billing/new-process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ org_id: orgId })
    });
    
    const result = await response.json();
    console.log('Status:', response.status);
    console.log('Resultado:', JSON.stringify(result, null, 2));
    
    // 5. Verificar registros de cobrança criados
    if (response.ok && result.success) {
      console.log('\n5. Verificando registros de cobrança criados...');
      const { data: billingRecords } = await supabase
        .from('message_billing')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5);
        
      console.log(`Registros de cobrança: ${billingRecords?.length || 0}`);
      if (billingRecords && billingRecords.length > 0) {
        billingRecords.forEach((record, i) => {
          console.log(`${i + 1}. Tokens: ${record.tokens_used}, Créditos: ${record.credits_charged}, Status: ${record.billing_status}`);
        });
      }
      
      // Verificar novo saldo
      const { data: newCredits } = await supabase
        .from('organization_credits')
        .select('balance')
        .eq('org_id', orgId)
        .single();
        
      if (newCredits) {
        console.log(`\nNovo saldo: ${newCredits.balance} créditos`);
      }
    }
    
  } catch (error) {
    console.error('Erro no teste:', error);
  }
  
  console.log('\n=== TESTE CONCLUÍDO ===');
}

testNewBilling().catch(console.error);