require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseSchema() {
  console.log('Testing database operations...');
  
  try {
    // Test 1: Simple select to verify connection
    console.log('\n--- Test 1: Verifying connection ---');
    const { data: testConnection, error: connError } = await supabase
      .from('usage_events')
      .select('count')
      .limit(1);
    
    if (connError) {
      console.log('Connection test failed:', connError);
    } else {
      console.log('Connection successful');
    }
    
    // Test 2: Check if we can read from credit_wallets
    console.log('\n--- Test 2: Reading credit_wallets ---');
    const { data: wallets, error: walletError } = await supabase
      .from('credit_wallets')
      .select('org_id')
      .limit(1);
    
    if (walletError) {
      console.log('credit_wallets read failed:', walletError);
    } else {
      console.log('credit_wallets read successful, sample org_id type:', typeof wallets[0]?.org_id);
    }
    
    // Test 3: Try to insert with explicit type casting
    console.log('\n--- Test 3: Insert with explicit casting ---');
    const testData = {
      org_id: 'test-org-' + Date.now(),
      agent_id: 'test-agent',
      message_id: 'test-msg-' + Date.now(),
      channel: 'test',
      input_tokens: 1,
      output_tokens: 1,
      cost_credits: 1,
      meta: { test: true }
    };
    
    // First, ensure we have a credit wallet for this org
    const { error: walletInsertError } = await supabase
      .from('credit_wallets')
      .upsert({
        org_id: testData.org_id,
        balance: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (walletInsertError) {
      console.log('Failed to create test wallet:', walletInsertError);
    } else {
      console.log('Test wallet created successfully');
    }
    
    // Now try to insert usage event
    const { data: insertResult, error: insertError } = await supabase
      .from('usage_events')
      .insert(testData);
    
    if (insertError) {
      console.log('Insert failed:', insertError);
      
      // Test 4: Try with RLS disabled (if we have permissions)
      console.log('\n--- Test 4: Checking RLS status ---');
      const { data: rlsStatus, error: rlsError } = await supabase
        .rpc('check_rls_status', { table_name: 'usage_events' });
      
      if (rlsError) {
        console.log('Could not check RLS status:', rlsError.message);
      } else {
        console.log('RLS status:', rlsStatus);
      }
      
    } else {
      console.log('Insert succeeded!', insertResult);
      
      // Clean up test data
      await supabase.from('usage_events').delete().eq('org_id', testData.org_id);
      await supabase.from('credit_wallets').delete().eq('org_id', testData.org_id);
      console.log('Test data cleaned up');
    }
    
    // Test 5: Check if the trigger function exists and works
    console.log('\n--- Test 5: Testing trigger function ---');
    const { data: functionTest, error: functionError } = await supabase
      .rpc('update_credit_wallet_balance');
    
    if (functionError) {
      console.log('Trigger function test failed:', functionError);
    } else {
      console.log('Trigger function exists and is callable');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkDatabaseSchema();