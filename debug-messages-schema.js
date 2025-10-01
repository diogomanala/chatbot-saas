const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugMessagesSchema() {
  console.log('🔍 Debugging messages table schema...\n');

  try {
    // 1. Verificar tipos das colunas da tabela messages
    console.log('1. Verificando tipos das colunas da tabela messages:');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'messages')
      .eq('table_schema', 'public')
      .order('ordinal_position');

    if (columnsError) {
      console.error('❌ Erro ao buscar colunas:', columnsError);
    } else {
      columns.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // 2. Verificar constraints da tabela messages
    console.log('\n2. Verificando constraints da tabela messages:');
    const { data: constraints, error: constraintsError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name, constraint_type')
      .eq('table_name', 'messages')
      .eq('table_schema', 'public');

    if (constraintsError) {
      console.error('❌ Erro ao buscar constraints:', constraintsError);
    } else {
      constraints.forEach(constraint => {
        console.log(`   ${constraint.constraint_name}: ${constraint.constraint_type}`);
      });
    }

    // 3. Verificar foreign keys da tabela messages
    console.log('\n3. Verificando foreign keys da tabela messages:');
    const { data: foreignKeys, error: fkError } = await supabase
      .from('information_schema.key_column_usage')
      .select('column_name, referenced_table_name, referenced_column_name')
      .eq('table_name', 'messages')
      .eq('table_schema', 'public')
      .not('referenced_table_name', 'is', null);

    if (fkError) {
      console.error('❌ Erro ao buscar foreign keys:', fkError);
    } else {
      foreignKeys.forEach(fk => {
        console.log(`   ${fk.column_name} -> ${fk.referenced_table_name}.${fk.referenced_column_name}`);
      });
    }

    // 4. Verificar tipos das tabelas referenciadas
    console.log('\n4. Verificando tipos das colunas nas tabelas referenciadas:');
    
    // Verificar organizations.id
    const { data: orgColumns, error: orgError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'organizations')
      .eq('column_name', 'id')
      .eq('table_schema', 'public');

    if (orgError) {
      console.error('❌ Erro ao buscar coluna organizations.id:', orgError);
    } else if (orgColumns.length > 0) {
      console.log(`   organizations.id: ${orgColumns[0].data_type}`);
    }

    // Verificar devices.id
    const { data: deviceColumns, error: deviceError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'devices')
      .eq('column_name', 'id')
      .eq('table_schema', 'public');

    if (deviceError) {
      console.error('❌ Erro ao buscar coluna devices.id:', deviceError);
    } else if (deviceColumns.length > 0) {
      console.log(`   devices.id: ${deviceColumns[0].data_type}`);
    }

    // 5. Tentar inserir uma mensagem outbound simples para ver o erro exato
    console.log('\n5. Testando inserção de mensagem outbound:');
    
    const testMessage = {
      org_id: '123e4567-e89b-12d3-a456-426614174000', // UUID válido como string
      device_id: '123e4567-e89b-12d3-a456-426614174001', // UUID válido como string
      direction: 'outbound',
      sender_phone: '+5511999999999',
      receiver_phone: '+5511888888888',
      content: 'Test message',
      message_type: 'text',
      status: 'sent',
      external_id: 'test-external-id'
    };

    const { data: insertResult, error: insertError } = await supabase
      .from('messages')
      .insert(testMessage)
      .select();

    if (insertError) {
      console.error('❌ Erro na inserção:', insertError);
      console.error('   Código:', insertError.code);
      console.error('   Detalhes:', insertError.details);
      console.error('   Hint:', insertError.hint);
    } else {
      console.log('✅ Inserção bem-sucedida:', insertResult);
      
      // Limpar o registro de teste
      if (insertResult && insertResult.length > 0) {
        await supabase
          .from('messages')
          .delete()
          .eq('id', insertResult[0].id);
        console.log('🧹 Registro de teste removido');
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugMessagesSchema();