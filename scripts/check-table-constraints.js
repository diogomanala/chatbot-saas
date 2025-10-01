require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
  try {
    console.log('Checking table constraints and structure...');
    
    // Try to get table definition using SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'usage_events' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    });
    
    if (error) {
      console.log('Could not get columns via RPC, trying alternative method...');
      
      // Try different channel values to see which ones work
      const channelsToTest = ['whatsapp', 'telegram', 'web', 'api', 'chat', 'sms', 'email'];
      
      console.log('\nTesting different channel values:');
      
      for (const channel of channelsToTest) {
        const testData = {
          org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
          agent_id: 'f99ae725-f996-483d-8813-cde922d8877a',
          message_id: `test-${channel}-${Date.now()}`,
          channel: channel,
          input_tokens: 1,
          output_tokens: 1,
          cost_credits: 1,
          meta: { test: true }
        };
        
        const { data: insertResult, error: insertError } = await supabase
          .from('usage_events')
          .insert(testData)
          .select();
        
        if (insertError) {
          console.log(`❌ Channel '${channel}': ${insertError.message}`);
        } else {
          console.log(`✅ Channel '${channel}': SUCCESS`);
          
          // Clean up successful test record
          await supabase
            .from('usage_events')
            .delete()
            .eq('message_id', testData.message_id);
        }
      }
      
    } else {
      console.log('Table structure:', data);
    }
    
    // Also check what constraints exist
    console.log('\n--- Checking constraints ---');
    const { data: constraints, error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          conname as constraint_name,
          pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint 
        WHERE conrelid = 'public.usage_events'::regclass;
      `
    });
    
    if (constraintError) {
      console.log('Could not get constraints:', constraintError);
    } else {
      console.log('Table constraints:', constraints);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkConstraints();