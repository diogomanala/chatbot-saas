// =====================================================
// VERIFICAR ESQUEMA DA TABELA MESSAGES
// =====================================================
// Este script verifica os tipos de dados das colunas
// da tabela messages para identificar o problema
// =====================================================

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTableSchema() {
  console.log('🔍 Verificando esquema da tabela messages...\n');

  try {
    // Fazer uma consulta simples para ver os dados
    const { data: sampleData, error: sampleError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Erro ao buscar dados de exemplo:', sampleError);
    } else {
      console.log('✅ Dados de exemplo da tabela messages:');
      if (sampleData && sampleData.length > 0) {
        const sample = sampleData[0];
        console.log('\n--- Exemplo de registro ---');
        Object.keys(sample).forEach(key => {
          const value = sample[key];
          const type = typeof value;
          console.log(`${key}: ${value} (${type})`);
        });
      } else {
        console.log('Nenhum registro encontrado na tabela.');
      }
    }

    // Tentar inserir um registro simples para ver onde está o erro
    console.log('\n🧪 Testando inserção simples...');
    
    const testData = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa', // string UUID
      chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b',
      device_id: '9d166619-e7cf-4f5e-9637-65c6f4d2481f',
      phone_number: '+5511999999999',
      message_content: 'Teste simples',
      direction: 'outbound',
      status: 'sent',
      external_id: `simple_test_${Date.now()}`,
      tokens_used: 10,
      billing_status: 'pending',
      created_at: new Date().toISOString(),
      metadata: { test: true }
    };

    console.log('Dados a serem inseridos:');
    console.log(JSON.stringify(testData, null, 2));

    const { data: insertResult, error: insertError } = await supabase
      .from('messages')
      .insert(testData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ ERRO na inserção:', insertError);
      
      // Vamos tentar com org_id como UUID explícito
      console.log('\n🔄 Tentando novamente com conversão UUID...');
      
      // Não podemos fazer cast no cliente, então vamos tentar uma abordagem diferente
      console.log('O problema parece estar no trigger. Vamos verificar a função simple_debit_credits...');
      
    } else {
      console.log('✅ SUCESSO na inserção:', insertResult.id);
    }

    console.log('\n🎉 Verificação concluída!');
    return true;

  } catch (error) {
    console.error('💥 ERRO GERAL:', error);
    return false;
  }
}

// Executar a verificação
checkTableSchema()
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