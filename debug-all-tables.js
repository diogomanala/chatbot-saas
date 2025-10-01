const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAllTables() {
  console.log('🔍 Debugging all billing-related tables...');
  
  const tables = ['credit_wallets', 'usage_events', 'topup_events', 'usage_ledger'];
  
  for (const tableName of tables) {
    console.log(`\n📊 ${tableName} table:`);
    
    try {
      // Get table structure using raw SQL
      const { data: columns, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });
      
      if (error) {
        console.error(`❌ Error getting ${tableName} structure:`, error);
        
        // Try alternative method - direct query
        const { data: tableData, error: tableError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
          
        if (tableError) {
          console.error(`❌ Error querying ${tableName}:`, tableError);
        } else {
          console.log(`✅ ${tableName} exists and is queryable`);
          if (tableData && tableData.length > 0) {
            console.log('Sample data keys:', Object.keys(tableData[0]));
          }
        }
      } else {
        console.log('Columns:');
        columns.forEach(col => {
          console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
      }
    } catch (err) {
      console.error(`❌ Exception for ${tableName}:`, err.message);
    }
  }
  
  // Test specific operations that are failing
  console.log('\n🧪 Testing problematic operations...');
  
  try {
    // Test 1: Simple insert into credit_wallets
    console.log('\n1. Testing credit_wallets insert...');
    const { data: insertData, error: insertError } = await supabase
      .from('credit_wallets')
      .insert({
        id: 'debug-test-id',
        org_id: 'debug-test-org',
        balance: 1000
      })
      .select();
      
    if (insertError) {
      console.error('❌ Insert failed:', insertError);
    } else {
      console.log('✅ Insert successful:', insertData);
    }
    
    // Test 2: Update by org_id (this is where the error occurs)
    console.log('\n2. Testing credit_wallets update by org_id...');
    const { data: updateData, error: updateError } = await supabase
      .from('credit_wallets')
      .update({ balance: 2000 })
      .eq('org_id', 'debug-test-org')
      .select();
      
    if (updateError) {
      console.error('❌ Update failed:', updateError);
    } else {
      console.log('✅ Update successful:', updateData);
    }
    
    // Test 3: Select by org_id
    console.log('\n3. Testing credit_wallets select by org_id...');
    const { data: selectData, error: selectError } = await supabase
      .from('credit_wallets')
      .select('*')
      .eq('org_id', 'debug-test-org');
      
    if (selectError) {
      console.error('❌ Select failed:', selectError);
    } else {
      console.log('✅ Select successful:', selectData);
    }
    
    // Cleanup
    console.log('\n4. Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('credit_wallets')
      .delete()
      .eq('org_id', 'debug-test-org');
      
    if (deleteError) {
      console.error('❌ Delete failed:', deleteError);
    } else {
      console.log('✅ Cleanup successful');
    }
    
  } catch (err) {
    console.error('❌ Test exception:', err.message);
  }
}

debugAllTables().catch(console.error);