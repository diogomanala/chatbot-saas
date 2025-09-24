require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupNewTables() {
  console.log('=== CONFIGURANDO NOVAS TABELAS ===\n');
  
  try {
    // 1. Criar tabela message_billing
    console.log('1. Criando tabela message_billing...');
    const { error: billingTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS message_billing (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID NOT NULL,
          org_id TEXT NOT NULL,
          tokens_used INTEGER NOT NULL DEFAULT 0,
          credits_charged DECIMAL(10,4) NOT NULL DEFAULT 0,
          billing_status TEXT NOT NULL DEFAULT 'pending' CHECK (billing_status IN ('pending', 'charged', 'failed')),
          processed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (billingTableError) {
      console.log('Tentando criar tabela diretamente...');
      // Tentar criar usando query direta
      const { error: directError } = await supabase
        .from('message_billing')
        .select('*')
        .limit(0);
        
      if (directError && directError.code === '42P01') {
        console.log('❌ Não foi possível criar a tabela via Supabase client');
        console.log('Você precisa executar o SQL manualmente no painel do Supabase:');
        console.log('1. Acesse https://supabase.com/dashboard');
        console.log('2. Vá para SQL Editor');
        console.log('3. Execute o conteúdo do arquivo create-billing-table.sql');
        return;
      }
    }
    
    console.log('✅ Tabela message_billing configurada');
    
    // 2. Criar tabela organization_credits
    console.log('\n2. Criando tabela organization_credits...');
    const { error: creditsTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS organization_credits (
          id SERIAL PRIMARY KEY,
          org_id TEXT NOT NULL UNIQUE,
          balance DECIMAL(10,4) NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'BRL',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (creditsTableError) {
      console.log('Tentando verificar se tabela existe...');
      const { error: directError } = await supabase
        .from('organization_credits')
        .select('*')
        .limit(0);
        
      if (directError && directError.code === '42P01') {
        console.log('❌ Não foi possível criar a tabela via Supabase client');
        return;
      }
    }
    
    console.log('✅ Tabela organization_credits configurada');
    
    // 3. Inserir saldo inicial para organizações existentes
    console.log('\n3. Configurando saldos iniciais...');
    
    // Buscar organizações únicas das mensagens
    const { data: orgs, error: orgsError } = await supabase
      .from('messages')
      .select('org_id')
      .not('org_id', 'is', null);
      
    if (orgsError) {
      console.error('Erro ao buscar organizações:', orgsError);
      return;
    }
    
    const uniqueOrgs = [...new Set(orgs.map(o => o.org_id))];
    console.log(`Encontradas ${uniqueOrgs.length} organizações únicas`);
    
    // Inserir saldos iniciais
    for (const orgId of uniqueOrgs) {
      const { error: insertError } = await supabase
        .from('organization_credits')
        .upsert({
          org_id: orgId,
          balance: 1000.0 // Saldo inicial
        }, {
          onConflict: 'org_id',
          ignoreDuplicates: true
        });
        
      if (insertError) {
        console.log(`Erro ao inserir saldo para ${orgId}:`, insertError.message);
      } else {
        console.log(`✅ Saldo configurado para organização: ${orgId}`);
      }
    }
    
    console.log('\n=== CONFIGURAÇÃO CONCLUÍDA ===');
    console.log('As novas tabelas estão prontas para uso!');
    
  } catch (error) {
    console.error('Erro na configuração:', error);
  }
}

setupNewTables().catch(console.error);