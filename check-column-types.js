const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumnTypes() {
  console.log('🔍 Checking column types in billing tables...');
  
  try {
    // Check credit_wallets table structure
    const { data: creditWalletsColumns, error: cwError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'credit_wallets')
      .eq('table_schema', 'public');
    
    if (cwError) {
      console.error('❌ Error checking credit_wallets:', cwError);
    } else {
      console.log('\n📊 credit_wallets table structure:');
      creditWalletsColumns.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
    
    // Check usage_events table structure
    const { data: usageEventsColumns, error: ueError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'usage_events')
      .eq('table_schema', 'public');
    
    if (ueError) {
      console.error('❌ Error checking usage_events:', ueError);
    } else {
      console.log('\n📊 usage_events table structure:');
      usageEventsColumns.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
    
    // Check topup_events table structure
    const { data: topupEventsColumns, error: teError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'topup_events')
      .eq('table_schema', 'public');
    
    if (teError) {
      console.error('❌ Error checking topup_events:', teError);
    } else {
      console.log('\n📊 topup_events table structure:');
      topupEventsColumns.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
    
    // Test a simple insert to credit_wallets to see what fails
    console.log('\n🧪 Testing insert to credit_wallets...');
    const testOrgId = 'test-org-' + Date.now();
    
    const { data: insertResult, error: insertError } = await supabase
      .from('credit_wallets')
      .insert({
        org_id: testOrgId,
        balance: 100
      })
      .select();
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError.message);
      console.error('   Details:', insertError.details);
      console.error('   Hint:', insertError.hint);
    } else {
      console.log('✅ Insert successful:', insertResult);
      
      // Clean up test data
      await supabase
        .from('credit_wallets')
        .delete()
        .eq('org_id', testOrgId);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkColumnTypes();