// =====================================================
// TESTE COMPLETO DO SISTEMA DE COBRANÇA
// Execute após rodar o SQL no Supabase
// =====================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testCompleteBillingSystem() {
  console.log('🚀 TESTE COMPLETO DO SISTEMA DE COBRANÇA');
  console.log('==========================================\n');

  const testOrgId = 'test-org-' + Date.now();
  const testMessageId = 'msg-' + Date.now();
  const testContent = 'Esta é uma mensagem de teste para verificar se o sistema de cobrança está funcionando perfeitamente. Vamos calcular os tokens e processar a cobrança.';

  try {
    // 1. Verificar se as tabelas existem
    console.log('📋 1. Verificando se as tabelas foram criadas...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['organization_credits', 'message_billing']);

    if (tablesError) {
      console.error('❌ Erro ao verificar tabelas:', tablesError.message);
      return false;
    }

    const tableNames = tables?.map(t => t.table_name) || [];
    console.log('✅ Tabelas encontradas:', tableNames);
    
    if (!tableNames.includes('organization_credits') || !tableNames.includes('message_billing')) {
      console.error('❌ Tabelas necessárias não encontradas. Execute o SQL primeiro!');
      return false;
    }

    // 2. Testar função de adicionar créditos
    console.log('\n💰 2. Testando adição de créditos...');
    const { data: addResult, error: addError } = await supabase.rpc('add_credits', {
      p_org_id: testOrgId,
      p_amount: 500.00
    });

    if (addError) {
      console.error('❌ Erro ao adicionar créditos:', addError.message);
      return false;
    }

    console.log('✅ Créditos adicionados:', addResult);

    // 3. Verificar saldo
    console.log('\n💳 3. Verificando saldo da organização...');
    const { data: orgData, error: orgError } = await supabase
      .from('organization_credits')
      .select('*')
      .eq('org_id', testOrgId)
      .single();

    if (orgError) {
      console.error('❌ Erro ao verificar saldo:', orgError.message);
      return false;
    }

    console.log('✅ Dados da organização:', orgData);

    // 4. Testar processamento de cobrança
    console.log('\n⚡ 4. Testando processamento de cobrança...');
    console.log(`📝 Conteúdo da mensagem (${testContent.length} caracteres):`);
    console.log(`"${testContent.substring(0, 100)}..."`);
    
    const { data: billingResult, error: billingError } = await supabase.rpc('process_message_billing', {
      p_message_id: testMessageId,
      p_org_id: testOrgId,
      p_content: testContent
    });

    if (billingError) {
      console.error('❌ Erro no processamento de cobrança:', billingError.message);
      return false;
    }

    console.log('✅ Resultado da cobrança:', billingResult);

    // 5. Verificar se a cobrança foi registrada
    console.log('\n📊 5. Verificando registro de cobrança...');
    const { data: billingRecord, error: recordError } = await supabase
      .from('message_billing')
      .select('*')
      .eq('message_id', testMessageId)
      .single();

    if (recordError) {
      console.error('❌ Erro ao verificar registro:', recordError.message);
      return false;
    }

    console.log('✅ Registro de cobrança:', billingRecord);

    // 6. Testar estatísticas
    console.log('\n📈 6. Testando estatísticas...');
    const { data: stats, error: statsError } = await supabase.rpc('get_billing_stats', {
      p_org_id: testOrgId
    });

    if (statsError) {
      console.error('❌ Erro ao obter estatísticas:', statsError.message);
      return false;
    }

    console.log('✅ Estatísticas:', stats);

    // 7. Testar cobrança duplicada (deve falhar)
    console.log('\n🔒 7. Testando proteção contra cobrança duplicada...');
    const { data: duplicateResult, error: duplicateError } = await supabase.rpc('process_message_billing', {
      p_message_id: testMessageId, // Mesmo ID
      p_org_id: testOrgId,
      p_content: testContent
    });

    if (duplicateError) {
      console.error('❌ Erro inesperado:', duplicateError.message);
      return false;
    }

    if (duplicateResult.success === false && duplicateResult.error === 'Message already billed') {
      console.log('✅ Proteção contra cobrança duplicada funcionando:', duplicateResult);
    } else {
      console.error('❌ Proteção contra cobrança duplicada falhou:', duplicateResult);
      return false;
    }

    // 8. Testar saldo insuficiente
    console.log('\n💸 8. Testando saldo insuficiente...');
    
    // Primeiro, vamos esgotar o saldo
    const currentBalance = stats.current_balance;
    const largeContent = 'x'.repeat(currentBalance * 4000 + 1000); // Conteúdo que vai custar mais que o saldo
    
    const { data: insufficientResult, error: insufficientError } = await supabase.rpc('process_message_billing', {
      p_message_id: 'msg-insufficient-' + Date.now(),
      p_org_id: testOrgId,
      p_content: largeContent
    });

    if (insufficientError) {
      console.error('❌ Erro inesperado:', insufficientError.message);
      return false;
    }

    if (insufficientResult.success === false && insufficientResult.error === 'Insufficient credits') {
      console.log('✅ Proteção de saldo insuficiente funcionando:', {
        error: insufficientResult.error,
        current_balance: insufficientResult.current_balance,
        required: insufficientResult.required
      });
    } else {
      console.error('❌ Proteção de saldo insuficiente falhou:', insufficientResult);
      return false;
    }

    // 9. Verificar histórico
    console.log('\n📋 9. Verificando histórico de cobrança...');
    const { data: history, error: historyError } = await supabase
      .from('message_billing')
      .select('*')
      .eq('org_id', testOrgId)
      .order('charged_at', { ascending: false });

    if (historyError) {
      console.error('❌ Erro ao obter histórico:', historyError.message);
      return false;
    }

    console.log(`✅ Histórico obtido (${history.length} registros):`);
    history.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.tokens_used} tokens, R$ ${record.credits_charged}`);
    });

    // 10. Limpeza (opcional)
    console.log('\n🧹 10. Limpando dados de teste...');
    
    // Remover registros de cobrança
    await supabase
      .from('message_billing')
      .delete()
      .eq('org_id', testOrgId);
    
    // Remover organização
    await supabase
      .from('organization_credits')
      .delete()
      .eq('org_id', testOrgId);
    
    console.log('✅ Dados de teste removidos');

    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
    console.log('==========================================');
    console.log('✅ Sistema de cobrança está funcionando perfeitamente!');
    console.log('\n💡 Próximos passos:');
    console.log('1. Integre o código billing-integration.js no seu sistema');
    console.log('2. Use a classe BillingSystem nas suas rotas');
    console.log('3. Implemente o middleware checkBalance');
    console.log('4. Configure alertas de saldo baixo');
    console.log('5. Crie interface para gerenciar créditos');
    
    return true;

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
    return false;
  }
}

// Executar teste
console.log('🔧 Iniciando teste do sistema de cobrança...');
console.log('⏳ Aguarde...');

testCompleteBillingSystem().then(success => {
  if (success) {
    console.log('\n🎯 Sistema pronto para produção!');
    process.exit(0);
  } else {
    console.log('\n❌ Teste falhou. Verifique os erros acima.');
    console.log('\n💡 Dicas:');
    console.log('1. Certifique-se de que executou o SQL no Supabase');
    console.log('2. Verifique as variáveis de ambiente');
    console.log('3. Confirme as permissões do service role key');
    process.exit(1);
  }
});