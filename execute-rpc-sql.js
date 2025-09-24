const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

// Configurar cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function executeSQL() {
  console.log('🚀 Executando SQL para criar RPC transacional...');
  
  try {
    // Ler o arquivo SQL
    const sqlContent = fs.readFileSync('sql/perform_outbound_debit.sql', 'utf8');
    
    // Dividir em comandos separados
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    console.log(`📋 Executando ${commands.length} comandos SQL...`);
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`\n${i + 1}. Executando comando...`);
      
      // Executar via query raw
      const { data, error } = await supabase
        .from('_dummy_')
        .select('*')
        .limit(0);
      
      // Tentar executar via rpc se disponível
      try {
        const { error: rpcError } = await supabase.rpc('exec_sql', { 
          sql_query: command + ';' 
        });
        
        if (rpcError) {
          console.log('⚠️  RPC exec_sql não disponível, tentando método alternativo...');
          
          // Método direto via REST API
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
              'apikey': serviceRoleKey
            },
            body: JSON.stringify({ sql_query: command + ';' })
          });
          
          if (!response.ok) {
            console.log('❌ Falha na execução via REST API');
            console.log('💡 Execute manualmente no Supabase SQL Editor:');
            console.log(command);
          } else {
            console.log('✅ Comando executado com sucesso via REST API');
          }
        } else {
          console.log('✅ Comando executado com sucesso via RPC');
        }
      } catch (err) {
        console.log('⚠️  Erro na execução:', err.message);
        console.log('💡 Execute manualmente no Supabase SQL Editor:');
        console.log(command);
      }
    }
    
    console.log('\n✅ Processo concluído!');
    console.log('💡 Verifique se a função perform_outbound_debit foi criada no Supabase');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.log('\n💡 Execute manualmente no Supabase SQL Editor o conteúdo de:');
    console.log('sql/perform_outbound_debit.sql');
  }
}

executeSQL();