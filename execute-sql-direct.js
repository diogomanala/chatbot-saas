const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

// Configurar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createTablesManually() {
  console.log('🚀 Criando tabelas manualmente via Supabase...');
  
  try {
    // 1. Criar tabela message_billing
    console.log('\n📋 Criando tabela message_billing...');
    const { error: error1 } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS message_billing (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          message_id UUID NOT NULL,
          org_id TEXT NOT NULL,
          tokens_used INTEGER NOT NULL DEFAULT 0,
          credits_charged DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          charged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (error1) {
      console.log('⚠️  Tentativa via RPC falhou, usando método alternativo...');
      // Método alternativo: verificar se a tabela já existe
      const { data: tables } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'message_billing')
        .eq('table_schema', 'public');
      
      if (!tables || tables.length === 0) {
        console.log('❌ Não foi possível criar a tabela message_billing via API');
        console.log('💡 Você precisará criar manualmente no painel do Supabase');
      } else {
        console.log('✅ Tabela message_billing já existe');
      }
    } else {
      console.log('✅ Tabela message_billing criada com sucesso');
    }
    
    // 2. Criar tabela organization_credits
    console.log('\n📋 Criando tabela organization_credits...');
    const { error: error2 } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS organization_credits (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          org_id TEXT UNIQUE NOT NULL,
          balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (error2) {
      console.log('⚠️  Tentativa via RPC falhou, usando método alternativo...');
      const { data: tables2 } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'organization_credits')
        .eq('table_schema', 'public');
      
      if (!tables2 || tables2.length === 0) {
        console.log('❌ Não foi possível criar a tabela organization_credits via API');
        console.log('💡 Você precisará criar manualmente no painel do Supabase');
      } else {
        console.log('✅ Tabela organization_credits já existe');
      }
    } else {
      console.log('✅ Tabela organization_credits criada com sucesso');
    }
    
    // 3. Verificar se as tabelas existem
    console.log('\n🔍 Verificando tabelas criadas...');
    
    const { data: allTables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['message_billing', 'organization_credits']);
    
    if (tablesError) {
      console.log('⚠️  Não foi possível verificar as tabelas:', tablesError.message);
    } else {
      console.log('📊 Tabelas encontradas:', allTables?.map(t => t.table_name) || []);
    }
    
    // 4. Inserir saldo inicial para organizações existentes
    console.log('\n💰 Inserindo saldos iniciais...');
    
    const { data: orgs } = await supabase
      .from('messages')
      .select('org_id')
      .not('org_id', 'is', null);
    
    if (orgs && orgs.length > 0) {
      const uniqueOrgs = [...new Set(orgs.map(o => o.org_id))];
      console.log(`📋 Encontradas ${uniqueOrgs.length} organizações únicas`);
      
      for (const orgId of uniqueOrgs) {
        try {
          const { error: insertError } = await supabase
            .from('organization_credits')
            .upsert({
              org_id: orgId,
              balance: 1000.00 // Saldo inicial
            }, {
              onConflict: 'org_id'
            });
          
          if (insertError) {
            console.log(`⚠️  Erro ao inserir saldo para ${orgId}:`, insertError.message);
          } else {
            console.log(`✅ Saldo inicial criado para organização: ${orgId}`);
          }
        } catch (err) {
          console.log(`❌ Erro ao processar organização ${orgId}:`, err.message);
        }
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    return false;
  }
}

console.log('🚀 Executando criação de tabelas via Supabase Client...');

createTablesManually().then(success => {
  if (success) {
    console.log('\n✅ Processo concluído!');
    console.log('\n💡 Próximos passos:');
    console.log('1. Verifique as tabelas no painel do Supabase');
    console.log('2. Se as tabelas não foram criadas, execute o SQL manualmente:');
    console.log('   - Acesse: https://supabase.com/dashboard/project/[PROJECT]/sql');
    console.log('   - Cole o conteúdo do arquivo create-billing-table.sql');
    console.log('3. Teste o sistema: node test-new-billing.js');
  } else {
    console.log('\n❌ Processo falhou.');
    console.log('\n💡 Solução manual:');
    console.log('1. Acesse o painel do Supabase');
    console.log('2. Vá em SQL Editor');
    console.log('3. Execute o conteúdo do arquivo create-billing-table.sql');
  }
  
  process.exit(success ? 0 : 1);
});