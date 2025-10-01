const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseTriggers() {
  try {
    console.log('🔍 Verificando triggers na tabela messages...');
    
    // Verificar triggers na tabela messages
    const { data: triggers, error: triggerError } = await supabase
      .rpc('sql', {
        query: `
          SELECT 
            trigger_name,
            event_manipulation,
            action_timing,
            action_statement
          FROM information_schema.triggers 
          WHERE event_object_table = 'messages'
          ORDER BY trigger_name;
        `
      });

    if (triggerError) {
      console.error('❌ Erro ao buscar triggers:', triggerError);
    } else {
      console.log('📋 Triggers encontrados:', triggers);
    }

    // Verificar funções relacionadas a messages
    console.log('\n🔍 Verificando funções relacionadas...');
    
    const { data: functions, error: functionError } = await supabase
      .rpc('sql', {
        query: `
          SELECT 
            routine_name,
            routine_definition
          FROM information_schema.routines 
          WHERE routine_name LIKE '%message%' 
          OR routine_definition LIKE '%messages%'
          ORDER BY routine_name;
        `
      });

    if (functionError) {
      console.error('❌ Erro ao buscar funções:', functionError);
    } else {
      console.log('📋 Funções encontradas:', functions);
    }

    // Verificar constraints na tabela messages
    console.log('\n🔍 Verificando constraints...');
    
    const { data: constraints, error: constraintError } = await supabase
      .rpc('sql', {
        query: `
          SELECT 
            constraint_name,
            constraint_type,
            column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'messages'
          ORDER BY constraint_name;
        `
      });

    if (constraintError) {
      console.error('❌ Erro ao buscar constraints:', constraintError);
    } else {
      console.log('📋 Constraints encontradas:', constraints);
    }

  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

checkDatabaseTriggers();