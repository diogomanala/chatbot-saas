const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://anlemekgocrrllsogxix.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFubGVtZWtnb2Nycmxsc29neGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MDEyMjMsImV4cCI6MjA3MzE3NzIyM30.7K4zVdnDh_3YuBz59PX8WoRwDxKjXJ0KXnD1tNvp7iM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggersAndFunctions() {
  console.log('🔍 Verificando triggers e funções na tabela messages...\n');

  try {
    // Tentar buscar informações sobre triggers usando diferentes abordagens
    console.log('1. Tentando buscar triggers via information_schema...');
    
    // Primeira tentativa: buscar triggers
    try {
      const { data: triggers, error: triggerError } = await supabase
        .from('information_schema.triggers')
        .select('*')
        .eq('event_object_table', 'messages');
      
      if (triggerError) {
        console.log('❌ Erro ao buscar triggers:', triggerError.message);
      } else {
        console.log('✅ Triggers encontrados:', triggers);
      }
    } catch (e) {
      console.log('❌ Falha ao buscar triggers:', e.message);
    }

    // Segunda tentativa: buscar funções
    console.log('\n2. Tentando buscar funções via information_schema...');
    try {
      const { data: functions, error: functionError } = await supabase
        .from('information_schema.routines')
        .select('*')
        .eq('routine_type', 'FUNCTION');
      
      if (functionError) {
        console.log('❌ Erro ao buscar funções:', functionError.message);
      } else {
        console.log('✅ Funções encontradas:', functions?.length || 0);
        if (functions && functions.length > 0) {
          functions.forEach(func => {
            console.log(`  - ${func.routine_name} (${func.routine_schema})`);
          });
        }
      }
    } catch (e) {
      console.log('❌ Falha ao buscar funções:', e.message);
    }

    // Terceira tentativa: buscar constraints
    console.log('\n3. Tentando buscar constraints...');
    try {
      const { data: constraints, error: constraintError } = await supabase
        .from('information_schema.table_constraints')
        .select('*')
        .eq('table_name', 'messages');
      
      if (constraintError) {
        console.log('❌ Erro ao buscar constraints:', constraintError.message);
      } else {
        console.log('✅ Constraints encontradas:', constraints);
      }
    } catch (e) {
      console.log('❌ Falha ao buscar constraints:', e.message);
    }

    // Quarta tentativa: buscar colunas da tabela messages
    console.log('\n4. Verificando estrutura da tabela messages...');
    try {
      const { data: columns, error: columnError } = await supabase
        .from('information_schema.columns')
        .select('*')
        .eq('table_name', 'messages')
        .order('ordinal_position');
      
      if (columnError) {
        console.log('❌ Erro ao buscar colunas:', columnError.message);
      } else {
        console.log('✅ Colunas da tabela messages:');
        columns?.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
      }
    } catch (e) {
      console.log('❌ Falha ao buscar colunas:', e.message);
    }

    // Quinta tentativa: testar inserção com debug mais detalhado
    console.log('\n5. Testando inserção com debug detalhado...');
    
    const testMessage = {
      id: 'test-' + Date.now(),
      org_id: '761a8909-6674-440b-9811-7a232efb8a4b', // ID que sabemos que existe
      chatbot_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      device_id: 'device-123',
      direction: 'outbound',
      content: 'Test message',
      created_at: new Date().toISOString()
    };

    console.log('Tentando inserir:', testMessage);

    const { data: insertData, error: insertError } = await supabase
      .from('messages')
      .insert(testMessage)
      .select();

    if (insertError) {
      console.log('❌ Erro na inserção:', insertError);
      console.log('Código do erro:', insertError.code);
      console.log('Detalhes:', insertError.details);
      console.log('Hint:', insertError.hint);
      console.log('Message:', insertError.message);
    } else {
      console.log('✅ Inserção bem-sucedida:', insertData);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

checkTriggersAndFunctions();