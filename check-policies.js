const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPolicies() {
  console.log('🔍 Verificando políticas RLS na tabela messages...\n');

  try {
    // Verificar políticas RLS atuais usando query SQL direta
    const { data: policies, error } = await supabase.rpc('exec_sql', {
      sql: `SELECT schemaname, tablename, policyname, cmd, qual 
            FROM pg_policies 
            WHERE tablename = 'messages' 
            ORDER BY policyname;`
    });

    if (error) {
      console.error('❌ Erro ao buscar políticas:', error);
      return;
    }

    console.log('📋 Políticas RLS encontradas:');
    policies.forEach(policy => {
      console.log(`\n🔐 Política: ${policy.policyname}`);
      console.log(`   Comando: ${policy.cmd}`);
      console.log(`   Condição: ${policy.qual || 'N/A'}`);
    });

    // Verificar se ainda existem políticas com problemas de tipo
    const problematicPolicies = policies.filter(policy => 
      policy.qual && policy.qual.includes('org_id') && !policy.qual.includes('org_id::text')
    );

    if (problematicPolicies.length > 0) {
      console.log('\n⚠️  Políticas com possíveis problemas de tipo:');
      problematicPolicies.forEach(policy => {
        console.log(`   - ${policy.policyname}: ${policy.qual}`);
      });
    } else {
      console.log('\n✅ Todas as políticas parecem estar corretas!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkPolicies();