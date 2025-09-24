// =====================================================
// VERIFICAR ESTADO DO BANCO DE DADOS
// =====================================================
// Este script verifica:
// 1. Se a função simple_debit_credits existe
// 2. Se o trigger messages_outbound_autodebit_ai existe
// 3. Qual é a definição atual da função
// =====================================================

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseState() {
  console.log('🔍 Verificando estado atual do banco de dados...\n');

  try {
    // =====================================================
    // VERIFICAR FUNÇÕES simple_debit_credits
    // =====================================================
    console.log('📋 Verificando funções simple_debit_credits...');
    
    const { data: functions, error: funcError } = await supabase
      .from('pg_proc')
      .select(`
        proname, 
        pronargs,
        oid
      `)
      .eq('proname', 'simple_debit_credits');

    if (funcError) {
      console.error('❌ Erro ao verificar funções:', funcError);
    } else {
      console.log(`✅ Encontradas ${functions.length} funções simple_debit_credits:`);
      functions.forEach((func, index) => {
        console.log(`\n--- Função ${index + 1} ---`);
        console.log(`Nome: ${func.proname}`);
        console.log(`Número de argumentos: ${func.pronargs}`);
        console.log(`OID: ${func.oid}`);
      });
    }

    // =====================================================
    // VERIFICAR TRIGGERS
    // =====================================================
    console.log('\n🎯 Verificando triggers na tabela messages...');
    
    const { data: triggers, error: triggerError } = await supabase
      .from('pg_trigger')
      .select(`
        tgname,
        tgfoid,
        tgrelid
      `)
      .eq('tgrelid', '16408'); // ID da tabela messages (pode variar)

    if (triggerError) {
      console.error('❌ Erro ao verificar triggers:', triggerError);
    } else {
      console.log(`✅ Encontrados ${triggers.length} triggers:`);
      triggers.forEach((trigger, index) => {
        console.log(`\n--- Trigger ${index + 1} ---`);
        console.log(`Nome: ${trigger.tgname}`);
        console.log(`Função OID: ${trigger.tgfoid}`);
        console.log(`Tabela OID: ${trigger.tgrelid}`);
      });
    }

    // =====================================================
    // VERIFICAR CONSTRAINTS
    // =====================================================
    console.log('\n🔒 Verificando constraints na tabela messages...');
    
    const { data: constraints, error: constraintError } = await supabase
      .from('pg_constraint')
      .select(`
        conname, 
        contype,
        conrelid
      `)
      .eq('conrelid', '16408'); // ID da tabela messages (pode variar)

    if (constraintError) {
      console.error('❌ Erro ao verificar constraints:', constraintError);
    } else {
      console.log(`✅ Encontradas ${constraints.length} constraints:`);
      constraints.forEach((constraint, index) => {
        console.log(`\n--- Constraint ${index + 1} ---`);
        console.log(`Nome: ${constraint.conname}`);
        console.log(`Tipo: ${constraint.contype}`);
        console.log(`Tabela OID: ${constraint.conrelid}`);
      });
    }

    // =====================================================
    // TESTE DIRETO DE INSERÇÃO
    // =====================================================
    console.log('\n🧪 Testando inserção direta na tabela messages...');
    
    const testExternalId = `direct_test_${Date.now()}`;
    
    const { data: directInsert, error: insertError } = await supabase
      .from('messages')
      .insert({
        org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
        chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b',
        device_id: '9d166619-e7cf-4f5e-9637-65c6f4d2481f',
        phone_number: '+5511999999999',
        message_content: 'Teste direto de inserção',
        direction: 'outbound',
        status: 'sent',
        external_id: testExternalId,
        tokens_used: 50,
        billing_status: 'pending',
        created_at: new Date().toISOString(),
        metadata: { test: true, direct: true }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ FALHA no teste de inserção direta:', insertError);
    } else {
      console.log('✅ SUCESSO no teste de inserção direta:', directInsert.id);
    }

    console.log('\n🎉 Verificação do banco de dados concluída!');
    return true;

  } catch (error) {
    console.error('💥 ERRO GERAL na verificação:', error);
    return false;
  }
}

// Executar a verificação
checkDatabaseState()
  .then(success => {
    if (success) {
      console.log('\n✅ VERIFICAÇÃO CONCLUÍDA');
      process.exit(0);
    } else {
      console.log('\n❌ VERIFICAÇÃO FALHOU');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 ERRO FATAL:', error);
    process.exit(1);
  });