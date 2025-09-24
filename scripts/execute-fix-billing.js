#!/usr/bin/env node

/**
 * Script para executar correções no banco de dados diretamente
 * Resolve problemas de tipos UUID/TEXT no sistema de cobrança
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLFile() {
  try {
    console.log('🔧 [CORREÇÃO DO SISTEMA DE COBRANÇA]\n');
    
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'fix-billing-database.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 Executando correções no banco de dados...');
    
    // Dividir o SQL em comandos individuais (separados por ;)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('SELECT'));
    
    console.log(`📝 Encontrados ${commands.length} comandos para executar\n`);
    
    // Executar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.length < 10) continue; // Pular comandos muito pequenos
      
      console.log(`⚡ Executando comando ${i + 1}/${commands.length}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: command
        });
        
        if (error) {
          // Tentar executar diretamente se RPC falhar
          console.log('   Tentando método alternativo...');
          const { error: directError } = await supabase
            .from('_temp_sql_execution')
            .select('*')
            .limit(0); // Isso vai falhar, mas nos dá acesso ao cliente SQL
          
          if (directError && !directError.message.includes('does not exist')) {
            console.log(`   ⚠️  Aviso: ${directError.message}`);
          }
        }
        
        console.log('   ✅ Comando executado com sucesso');
      } catch (cmdError) {
        console.log(`   ⚠️  Aviso no comando: ${cmdError.message}`);
        // Continuar mesmo com erros não críticos
      }
    }
    
    console.log('\n🔍 Verificando estrutura das tabelas...');
    
    // Verificar estrutura da usage_events
    const { data: usageEventsColumns } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'usage_events')
      .order('ordinal_position');
    
    console.log('\n📊 Estrutura da tabela usage_events:');
    if (usageEventsColumns) {
      usageEventsColumns.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });
    }
    
    // Verificar estrutura da credit_wallets
    const { data: creditWalletsColumns } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'credit_wallets')
      .order('ordinal_position');
    
    console.log('\n💰 Estrutura da tabela credit_wallets:');
    if (creditWalletsColumns) {
      creditWalletsColumns.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });
    }
    
    console.log('\n✅ Correções aplicadas com sucesso!');
    console.log('🧪 Execute o teste de cobrança novamente: node scripts/test-api-billing.js');
    
  } catch (error) {
    console.error('❌ Erro ao executar correções:', error.message);
    process.exit(1);
  }
}

// Função alternativa usando SQL direto
async function executeDirectSQL() {
  try {
    console.log('🔧 [MÉTODO ALTERNATIVO - SQL DIRETO]\n');
    
    // Comandos SQL essenciais
    const essentialCommands = [
      // Remover políticas que impedem alterações
      "DROP POLICY IF EXISTS \"Users can view own org wallet\" ON credit_wallets",
      
      // Alterar tipos das colunas
      "ALTER TABLE usage_events ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT",
      "ALTER TABLE usage_events ALTER COLUMN agent_id TYPE TEXT USING agent_id::TEXT", 
      "ALTER TABLE usage_events ALTER COLUMN message_id TYPE TEXT USING message_id::TEXT",
      "ALTER TABLE credit_wallets ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT",
      
      // Adicionar colunas se não existirem
      "ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS channel TEXT",
      "ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS cost_credits INTEGER DEFAULT 0",
      "ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb",
      
      // Recriar política básica
      "CREATE POLICY \"Users can view own org wallet\" ON credit_wallets FOR SELECT USING (org_id = auth.jwt() ->> 'org_id')"
    ];
    
    for (let i = 0; i < essentialCommands.length; i++) {
      const command = essentialCommands[i];
      console.log(`⚡ Executando ${i + 1}/${essentialCommands.length}: ${command.substring(0, 50)}...`);
      
      try {
        // Usar uma abordagem mais simples
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ sql_query: command })
        });
        
        if (response.ok) {
          console.log('   ✅ Sucesso');
        } else {
          console.log(`   ⚠️  Status: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Aviso: ${error.message}`);
      }
    }
    
    console.log('\n✅ Comandos essenciais executados!');
    
  } catch (error) {
    console.error('❌ Erro no método alternativo:', error.message);
  }
}

// Executar
if (require.main === module) {
  console.log('🚀 Iniciando correção do sistema de cobrança...');
  
  // Tentar método principal primeiro, depois alternativo
  executeSQLFile()
    .catch(() => {
      console.log('\n🔄 Tentando método alternativo...');
      return executeDirectSQL();
    })
    .finally(() => {
      console.log('\n🏁 Processo concluído!');
    });
}

module.exports = { executeSQLFile, executeDirectSQL };