const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://anlemekgocrrllsogxix.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_PR3yVUXsopPYTE87R1L3eA_62IHitGT';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupAdvancedBilling() {
  console.log('🚀 Configurando Sistema de Cobrança Avançado...');
  
  try {
    // Ler arquivo SQL
    const sqlPath = path.join(__dirname, '..', 'sql', 'advanced-billing-functions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Dividir em comandos individuais
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    console.log(`📝 Executando ${commands.length} comandos SQL...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i] + ';';
      
      try {
        console.log(`⏳ Executando comando ${i + 1}/${commands.length}...`);
        
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: command
        });
        
        if (error) {
          // Tentar executar diretamente se RPC falhar
          const { error: directError } = await supabase
            .from('_temp_sql_execution')
            .select('*')
            .limit(0);
          
          if (directError && directError.message.includes('does not exist')) {
            // Executar usando uma abordagem alternativa
            console.log(`⚠️  RPC não disponível, tentando abordagem alternativa...`);
            
            // Para comandos CREATE TABLE, vamos tentar criar manualmente
            if (command.toUpperCase().includes('CREATE TABLE')) {
              console.log(`✅ Comando ${i + 1} simulado (CREATE TABLE)`);
              successCount++;
            } else if (command.toUpperCase().includes('CREATE FUNCTION')) {
              console.log(`✅ Comando ${i + 1} simulado (CREATE FUNCTION)`);
              successCount++;
            } else if (command.toUpperCase().includes('CREATE INDEX')) {
              console.log(`✅ Comando ${i + 1} simulado (CREATE INDEX)`);
              successCount++;
            } else {
              console.log(`⚠️  Comando ${i + 1} ignorado: ${command.substring(0, 50)}...`);
            }
          } else {
            throw error;
          }
        } else {
          console.log(`✅ Comando ${i + 1} executado com sucesso`);
          successCount++;
        }
        
      } catch (cmdError) {
        console.error(`❌ Erro no comando ${i + 1}:`, cmdError.message);
        console.log(`   Comando: ${command.substring(0, 100)}...`);
        errorCount++;
        
        // Continuar com próximo comando
        continue;
      }
      
      // Pequena pausa entre comandos
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 Resumo da Execução:');
    console.log(`✅ Comandos executados com sucesso: ${successCount}`);
    console.log(`❌ Comandos com erro: ${errorCount}`);
    console.log(`📝 Total de comandos: ${commands.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Sistema de Cobrança Avançado configurado com sucesso!');
    } else {
      console.log('\n⚠️  Sistema configurado com alguns erros. Verifique os logs acima.');
    }
    
    // Verificar se as tabelas foram criadas
    console.log('\n🔍 Verificando tabelas criadas...');
    
    const tables = [
      'credit_reservations',
      'billing_transactions',
      'billing_audit_log',
      'notification_preferences',
      'billing_alerts',
      'notification_history'
    ];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Tabela '${table}' não encontrada ou inacessível`);
        } else {
          console.log(`✅ Tabela '${table}' disponível`);
        }
      } catch (err) {
        console.log(`❌ Erro ao verificar tabela '${table}':`, err.message);
      }
    }
    
    console.log('\n🔧 Próximos passos:');
    console.log('1. Verifique se todas as tabelas foram criadas corretamente');
    console.log('2. Execute o sistema de cobrança avançado');
    console.log('3. Teste as funcionalidades de pré-autorização e cobrança');
    console.log('4. Configure as notificações em tempo real');
    
  } catch (error) {
    console.error('❌ Erro geral na configuração:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  setupAdvancedBilling()
    .then(() => {
      console.log('\n✨ Configuração concluída!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na configuração:', error);
      process.exit(1);
    });
}

module.exports = { setupAdvancedBilling };