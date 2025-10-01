require('dotenv').config({ path: '.env.local' });

/**
 * Script para processamento automático de mensagens
 * Implementa a sugestão do usuário de contar mensagens e aplicar fórmula automática
 * 
 * Uso:
 * node scripts/auto-process-messages.js [orgId]
 * 
 * Se orgId não for fornecido, processa todas as organizações
 */

async function autoProcessMessages() {
  try {
    const orgId = process.argv[2]; // Pegar orgId da linha de comando
    
    console.log('🚀 [AUTO-PROCESS] Iniciando processamento automático de mensagens');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    if (orgId) {
      console.log(`🎯 Processando organização específica: ${orgId}`);
    } else {
      console.log('🌐 Processando todas as organizações');
    }
    
    // Fazer chamada para a API local
    const apiUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const endpoint = `${apiUrl}/api/process-messages`;
    
    const requestBody = orgId 
      ? { orgId }
      : { processAll: true };
    
    console.log(`📡 Fazendo requisição para: ${endpoint}`);
    console.log(`📦 Payload:`, requestBody);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('\n📊 [RESULTADO]');
    console.log('✅ Status:', result.success ? 'SUCESSO' : 'FALHA');
    console.log('💬 Mensagem:', result.message);
    
    if (result.data) {
      console.log('📈 Dados:');
      console.log(`  - Mensagens processadas: ${result.data.messagesProcessed || 0}`);
      console.log(`  - Créditos debitados: ${result.data.creditsDebited || 0}`);
      console.log(`  - Saldo atual: ${result.data.currentBalance || 0}`);
    }
    
    console.log('\n🎉 Processamento concluído!');
    
    // Se processou uma org específica, mostrar estatísticas
    if (orgId && result.success) {
      console.log('\n📊 Obtendo estatísticas detalhadas...');
      
      const statsResponse = await fetch(`${endpoint}?orgId=${orgId}`, {
        method: 'GET'
      });
      
      if (statsResponse.ok) {
        const statsResult = await statsResponse.json();
        
        if (statsResult.success && statsResult.data.messageStats) {
          const stats = statsResult.data.messageStats;
          
          console.log('\n📈 [ESTATÍSTICAS DETALHADAS]');
          console.log(`📨 Total de mensagens: ${stats.total}`);
          console.log(`⏳ Pendentes: ${stats.pending}`);
          console.log(`✅ Cobradas: ${stats.charged}`);
          console.log(`❌ Falharam: ${stats.failed}`);
          console.log(`⏭️  Ignoradas: ${stats.skipped}`);
          console.log(`💰 Total de créditos cobrados: ${stats.totalCreditsCharged}`);
          console.log(`🔢 Total de tokens usados: ${stats.totalTokensUsed}`);
          console.log(`💳 Saldo atual: ${statsResult.data.currentBalance}`);
        }
      }
    }
    
  } catch (error) {
    console.error('\n❌ [ERRO] Falha no processamento automático:');
    console.error(error.message);
    
    if (error.stack) {
      console.error('\n🔍 Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Executar o script
autoProcessMessages();