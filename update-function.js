const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateFunction() {
  console.log('🔄 Updating debit_credits_simple function in remote database...');
  
  try {
    // Read the SQL function definition
    const sqlContent = fs.readFileSync('./sql/debit_credits_simple.sql', 'utf8');
    
    // Extract just the function definition (remove comments)
    const functionDefinition = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
      .join('\n');
    
    console.log('📝 Function definition to execute:');
    console.log(functionDefinition.substring(0, 200) + '...');
    
    // Execute the function creation
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: functionDefinition
    });
    
    if (error) {
      console.error('❌ Error updating function:', error);
      
      // Try alternative approach using raw SQL
      console.log('\n🔄 Trying alternative approach...');
      const { error: altError } = await supabase
        .from('_supabase_admin')
        .select('*')
        .limit(1);
        
      if (altError) {
        console.log('❌ Alternative approach also failed:', altError);
        console.log('\n💡 The function needs to be updated manually in the Supabase dashboard.');
        console.log('📋 Copy this SQL and run it in the SQL editor:');
        console.log('\n' + functionDefinition);
      }
    } else {
      console.log('✅ Function updated successfully:', data);
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    
    // Show the SQL that needs to be run manually
    try {
      const sqlContent = fs.readFileSync('./sql/debit_credits_simple.sql', 'utf8');
      console.log('\n💡 Please run this SQL manually in Supabase dashboard:');
      console.log('\n' + sqlContent);
    } catch (readErr) {
      console.error('❌ Could not read SQL file:', readErr);
    }
  }
}

updateFunction().catch(console.error);