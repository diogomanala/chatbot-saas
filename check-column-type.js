const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://rnqjjqxqhqxqhqxqhqxq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJucWpqcXhxaHF4cWhxeHFocXhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzA1NzE5NCwiZXhwIjoyMDUyNjMzMTk0fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'
);

async function checkColumnType() {
  try {
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'credit_wallets')
      .eq('column_name', 'org_id');
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Column info:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Exception:', err);
  }
}

checkColumnType();