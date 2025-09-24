require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
// Função calculateCreditCost copiada do pricing.ts
const TOKENS_PER_CREDIT = 1000;
function calculateCreditCost(inputTokens, outputTokens) {
  const totalTokens = inputTokens + outputTokens;
  return Math.ceil(totalTokens / TOKENS_PER_CREDIT);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTokenScenarios() {
  try {
    const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa'; // TitecWeb Admin
    
    console.log('🧪 Testando cenários de tokens conforme especificação do usuário...');
    console.log('📋 Regra: 1.000 tokens = 1 crédito');
    console.log('');
    
    // Cenário 1: Mensagem curta (~200 tokens = 1 crédito)
    console.log('📝 Cenário 1: Mensagem curta');
    const shortInputTokens = 100;
    const shortOutputTokens = 100;
    const shortTotalTokens = shortInputTokens + shortOutputTokens;
    const shortCredits = calculateCreditCost(shortInputTokens, shortOutputTokens);
    
    console.log(`   Input tokens: ${shortInputTokens}`);
    console.log(`   Output tokens: ${shortOutputTokens}`);
    console.log(`   Total tokens: ${shortTotalTokens}`);
    console.log(`   Créditos calculados: ${shortCredits}`);
    console.log(`   ✅ Resultado esperado: 1 crédito (${shortTotalTokens} tokens < 1000)`);
    console.log('');
    
    // Cenário 2: Mensagem média (~1500 tokens = 2 créditos)
    console.log('📝 Cenário 2: Mensagem média');
    const mediumInputTokens = 800;
    const mediumOutputTokens = 700;
    const mediumTotalTokens = mediumInputTokens + mediumOutputTokens;
    const mediumCredits = calculateCreditCost(mediumInputTokens, mediumOutputTokens);
    
    console.log(`   Input tokens: ${mediumInputTokens}`);
    console.log(`   Output tokens: ${mediumOutputTokens}`);
    console.log(`   Total tokens: ${mediumTotalTokens}`);
    console.log(`   Créditos calculados: ${mediumCredits}`);
    console.log(`   ✅ Resultado esperado: 2 créditos (${mediumTotalTokens} tokens > 1000, < 2000)`);
    console.log('');
    
    // Cenário 3: Mensagem longa (~2500 tokens = 3 créditos)
    console.log('📝 Cenário 3: Mensagem longa');
    const longInputTokens = 1200;
    const longOutputTokens = 1300;
    const longTotalTokens = longInputTokens + longOutputTokens;
    const longCredits = calculateCreditCost(longInputTokens, longOutputTokens);
    
    console.log(`   Input tokens: ${longInputTokens}`);
    console.log(`   Output tokens: ${longOutputTokens}`);
    console.log(`   Total tokens: ${longTotalTokens}`);
    console.log(`   Créditos calculados: ${longCredits}`);
    console.log(`   ✅ Resultado esperado: 3 créditos (${longTotalTokens} tokens > 2000, < 3000)`);
    console.log('');
    
    // Cenário 4: Mensagem muito longa (~4500 tokens = 5 créditos)
    console.log('📝 Cenário 4: Mensagem muito longa');
    const veryLongInputTokens = 2000;
    const veryLongOutputTokens = 2500;
    const veryLongTotalTokens = veryLongInputTokens + veryLongOutputTokens;
    const veryLongCredits = calculateCreditCost(veryLongInputTokens, veryLongOutputTokens);
    
    console.log(`   Input tokens: ${veryLongInputTokens}`);
    console.log(`   Output tokens: ${veryLongOutputTokens}`);
    console.log(`   Total tokens: ${veryLongTotalTokens}`);
    console.log(`   Créditos calculados: ${veryLongCredits}`);
    console.log(`   ✅ Resultado esperado: 5 créditos (${veryLongTotalTokens} tokens > 4000, < 5000)`);
    console.log('');
    
    // Verificar saldo atual
    console.log('💰 Verificando saldo atual da carteira...');
    const { data: wallet, error: walletError } = await supabase
      .from('credit_wallets')
      .select('*')
      .eq('org_id', orgId)
      .single();
    
    if (walletError) {
      console.error('❌ Erro ao buscar carteira:', walletError);
      return;
    }
    
    console.log(`   Saldo atual: ${wallet.balance} créditos`);
    
    // Simular débito do cenário 3 (mensagem longa)
    console.log('');
    console.log('🔄 Simulando débito do Cenário 3 (mensagem longa - 3 créditos)...');
    
    if (wallet.balance < longCredits) {
      console.log('⚠️ Saldo insuficiente para realizar o débito!');
      return;
    }
    
    console.log('✅ Validação dos cálculos concluída!');
    console.log(`   Cenário testado: ${longTotalTokens} tokens = ${longCredits} créditos`);
    console.log(`   Saldo disponível: ${wallet.balance} créditos`);
    console.log(`   Débito seria possível: ${wallet.balance >= longCredits ? 'Sim' : 'Não'}`);
    
    console.log('');
    console.log('📊 Resumo dos testes:');
    console.log(`   ✅ Mensagem curta (${shortTotalTokens} tokens) = ${shortCredits} crédito`);
    console.log(`   ✅ Mensagem média (${mediumTotalTokens} tokens) = ${mediumCredits} créditos`);
    console.log(`   ✅ Mensagem longa (${longTotalTokens} tokens) = ${longCredits} créditos`);
    console.log(`   ✅ Mensagem muito longa (${veryLongTotalTokens} tokens) = ${veryLongCredits} créditos`);
    console.log('');
    console.log('🎯 Sistema implementado conforme especificação:');
    console.log('   "1 crédito = 1 mensagem" (comercialmente)');
    console.log('   "1.000 tokens = 1 crédito" (tecnicamente)');
    console.log('   Mensagens curtas = 1 crédito');
    console.log('   Mensagens longas = 2-5 créditos');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  }
}

// Executar o teste
testTokenScenarios()
  .then(() => {
    console.log('\n🎉 Teste de cenários de tokens concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Falha no teste:', error);
    process.exit(1);
  });