const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRLSPolicies() {
  console.log('🔍 Verificando políticas RLS da tabela messages...\n');

  try {
    // Buscar políticas RLS da tabela messages
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'messages');

    if (error) {
      console.error('❌ Erro ao buscar políticas RLS:', error);
      return;
    }

    console.log('📋 Políticas RLS encontradas:');
    console.log('Total de políticas:', policies.length);
    console.log('');

    policies.forEach((policy, index) => {
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
    const insertPolicies = policies.filter(p => p.cmd === 'INSERT' || p.cmd === 'ALL');
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

checkRLSPolicies();