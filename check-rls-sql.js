const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRLSWithSQL() {
  console.log('🔍 Verificando políticas RLS da tabela messages usando SQL...\n');

  try {
    // Query SQL para buscar políticas RLS
    const { data, error } = await supabase.rpc('sql', {
      query: `
        SELECT 
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies 
        WHERE tablename = 'messages'
        ORDER BY policyname;
      `
    });

    if (error) {
      console.error('❌ Erro ao executar SQL:', error);
      
      // Tentar uma abordagem alternativa usando information_schema
      console.log('\n🔄 Tentando abordagem alternativa...\n');
      
      const { data: altData, error: altError } = await supabase.rpc('sql', {
        query: `
          SELECT 
            table_name,
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = 'messages' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });

      if (altError) {
        console.error('❌ Erro na abordagem alternativa:', altError);
        return;
      }

      console.log('📋 Estrutura da tabela messages:');
      altData.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      return;
    }

    console.log('📋 Políticas RLS encontradas:');
    console.log('Total de políticas:', data.length);
    console.log('');

    data.forEach((policy, index) => {
      console.log(`--- Política ${index + 1} ---`);
      console.log('Nome:', policy.policyname);
      console.log('Comando:', policy.cmd);
      console.log('Permissiva:', policy.permissive);
      console.log('Roles:', policy.roles);
      console.log('Qual:', policy.qual);
      console.log('With Check:', policy.with_check);
      console.log('');
    });

    // Verificar se há políticas específicas para INSERT
    const insertPolicies = data.filter(p => p.cmd === 'INSERT' || p.cmd === 'ALL');
    console.log('🔍 Políticas que afetam INSERT:', insertPolicies.length);
    
    insertPolicies.forEach((policy, index) => {
      console.log(`--- Política INSERT ${index + 1} ---`);
      console.log('Nome:', policy.policyname);
      console.log('Qual:', policy.qual);
      console.log('With Check:', policy.with_check);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkRLSWithSQL();