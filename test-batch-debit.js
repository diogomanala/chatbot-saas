// Script para testar processamento em lote local
// const fs = require('fs');
// const path = require('path');

// Simular dados de mensagens pendentes (baseado no que vimos no SQL)
const mockMessages = [
  {
    id: 'msg-001',
    org_id: 'org-123',
    message_content: 'Esta é uma mensagem de teste para calcular tokens e créditos necessários.',
    tokens_used: 0,
    direction: 'outbound',
    billing_status: null,
    created_at: new Date().toISOString()
  },
  {
    id: 'msg-002', 
    org_id: 'org-123',
    message_content: 'Outra mensagem mais longa para testar o cálculo de tokens baseado no comprimento do conteúdo da mensagem.',
    tokens_used: 0,
    direction: 'outbound',
    billing_status: 'pending',
    created_at: new Date().toISOString()
  }
];

// Simular saldo da organização
const mockBalance = 1093;

// Implementar lógica de cálculo local (mesma do AutoDebitService)
function calculateTokens(messageContent, tokensUsed) {
  if (tokensUsed && tokensUsed > 0) {
    return tokensUsed;
  }
  // Fórmula: 1 token ≈ 4 caracteres
  return Math.ceil(messageContent.length / 4);
}

function calculateCredits(tokens) {
  // Fórmula: 1000 tokens = 1 crédito
  return Math.ceil(tokens / 1000);
}

function testBatchProcessing() {
  console.log('🧪 Teste de Processamento em Lote - AutoDebit');
  console.log('=' .repeat(50));
  
  let totalCreditsNeeded = 0;
  let processableMessages = 0;
  
  console.log(`💰 Saldo atual da organização: ${mockBalance} créditos\n`);
  
  mockMessages.forEach((message, index) => {
    console.log(`📨 Mensagem ${index + 1}: ${message.id}`);
    console.log(`   Org ID: ${message.org_id}`);
    console.log(`   Direção: ${message.direction}`);
    console.log(`   Status: ${message.billing_status || 'null'}`);
    console.log(`   Conteúdo: "${message.message_content.substring(0, 50)}..."`);
    console.log(`   Tamanho: ${message.message_content.length} caracteres`);
    
    if (message.direction === 'outbound') {
      const tokens = calculateTokens(message.message_content, message.tokens_used);
      const credits = calculateCredits(tokens);
      
      console.log(`   📏 Tokens calculados: ${tokens}`);
      console.log(`   💳 Créditos necessários: ${credits}`);
      
      totalCreditsNeeded += credits;
      processableMessages++;
      
      console.log(`   ✅ Processável: Sim`);
    } else {
      console.log(`   ⏭️  Processável: Não (mensagem inbound)`);
    }
    
    console.log('');
  });
  
  console.log('📊 Resumo do Processamento:');
  console.log(`   Mensagens analisadas: ${mockMessages.length}`);
  console.log(`   Mensagens processáveis: ${processableMessages}`);
  console.log(`   Total de créditos necessários: ${totalCreditsNeeded}`);
  console.log(`   Saldo disponível: ${mockBalance}`);
  console.log(`   Saldo suficiente: ${mockBalance >= totalCreditsNeeded ? '✅ Sim' : '❌ Não'}`);
  
  if (mockBalance >= totalCreditsNeeded) {
    console.log(`   Saldo após processamento: ${mockBalance - totalCreditsNeeded}`);
  } else {
    console.log(`   ⚠️  Déficit: ${totalCreditsNeeded - mockBalance} créditos`);
  }
  
  console.log('\n🔍 Diagnóstico:');
  
  if (processableMessages === 0) {
    console.log('   ❌ Problema: Nenhuma mensagem outbound encontrada');
  } else if (totalCreditsNeeded === 0) {
    console.log('   ❌ Problema: Cálculo de créditos resultou em 0');
  } else if (mockBalance < totalCreditsNeeded) {
    console.log('   ❌ Problema: Saldo insuficiente para processar mensagens');
  } else {
    console.log('   ✅ Tudo parece estar correto para processamento');
    console.log('   💡 O problema pode estar na conectividade com o Supabase');
  }
  
  console.log('\n🛠️  Próximos passos recomendados:');
  console.log('   1. Verificar conectividade com Supabase');
  console.log('   2. Testar credenciais de acesso ao banco');
  console.log('   3. Verificar se o webhook está sendo chamado');
  console.log('   4. Analisar logs do servidor de produção');
}

testBatchProcessing();