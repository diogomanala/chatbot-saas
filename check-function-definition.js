const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFunctionDefinition() {
  console.log('🔍 Checking debit_credits_simple function definition...');
  
  try {
    // Try to call the function with test parameters to see the error
    console.log('Testing function call...');
    const { data: testResult, error: testError } = await supabase.rpc('debit_credits_simple', {
      p_org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      p_amount: 0.1
    });

    if (testError) {
      console.log('❌ Function call error:', testError.message);
      console.log('Error details:', testError);
    } else {
      console.log('✅ Function call successful:', testResult);
    }

    // Try to get function source using pg_get_functiondef
    console.log('\n🔍 Trying to get function definition...');
    const { data: funcDef, error: funcError } = await supabase.rpc('sql', {
      query: `
        SELECT pg_get_functiondef(oid) as definition
        FROM pg_proc 
        WHERE proname = 'debit_credits_simple';
      `
    });

    if (funcError) {
      console.error('❌ Error getting function definition:', funcError);
    } else if (funcDef && funcDef.length > 0) {
      console.log('✅ Function definition found:');
      funcDef.forEach(def => {
        console.log(def.definition);
      });
    } else {
      console.log('❌ No function definition found');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

checkFunctionDefinition().catch(console.error);