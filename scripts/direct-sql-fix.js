require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function directSQLFix() {
  try {
    console.log('🔧 Direct SQL approach to fix usage_events...');
    
    // Step 1: Try to create the table directly using the client
    console.log('\n🏗️  Creating usage_events table directly...');
    
    // First, let's try to drop and recreate without using exec_sql
    try {
      // Check if we can query the table first
      const { data: testQuery, error: testError } = await supabase
        .from('usage_events')
        .select('count')
        .limit(0);
      
      if (!testError) {
        console.log('✅ Table exists and is accessible');
      } else {
        console.log('⚠️  Table access error:', testError.message);
      }
    } catch (err) {
      console.log('⚠️  Table test error:', err.message);
    }
    
    // Step 2: Try a simple insert to see the exact error
    console.log('\n🧪 Testing simple insert to identify the exact issue...');
    
    const simpleTestData = {
      org_id: 'test-org-123',
      agent_id: 'test-agent-456', 
      message_id: 'test-message-' + Date.now(),
      channel: 'whatsapp',
      input_tokens: 1,
      output_tokens: 1,
      cost_credits: 1,
      meta: { test: true }
    };
    
    console.log('📝 Simple test data:', simpleTestData);
    
    const { data: simpleResult, error: simpleError } = await supabase
      .from('usage_events')
      .insert(simpleTestData)
      .select();
    
    if (simpleError) {
      console.error('❌ Simple insert failed:', simpleError);
      console.log('\n🔍 Error details:');
      console.log('  Code:', simpleError.code);
      console.log('  Message:', simpleError.message);
      console.log('  Details:', simpleError.details);
      console.log('  Hint:', simpleError.hint);
      
      // Step 3: Try with different approaches based on the error
      if (simpleError.message.includes('uuid = text')) {
        console.log('\n🔄 Detected UUID comparison issue. Trying alternative approaches...');
        
        // Try 1: Insert with explicit UUID casting
        console.log('\n🎯 Attempt 1: Using explicit string values...');
        
        const stringTestData = {
          org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
          agent_id: 'f99ae725-f996-483d-8813-cde922d8877a',
          message_id: 'msg-' + Date.now(),
          channel: 'whatsapp',
          input_tokens: 1,
          output_tokens: 1,
          cost_credits: 1,
          meta: { approach: 'string-values' }
        };
        
        const { data: stringResult, error: stringError } = await supabase
          .from('usage_events')
          .insert(stringTestData)
          .select();
        
        if (stringError) {
          console.error('❌ String approach failed:', stringError.message);
          
          // Try 2: Use upsert instead of insert
          console.log('\n🎯 Attempt 2: Using upsert...');
          
          const { data: upsertResult, error: upsertError } = await supabase
            .from('usage_events')
            .upsert(stringTestData)
            .select();
          
          if (upsertError) {
            console.error('❌ Upsert approach failed:', upsertError.message);
            
            // Try 3: Minimal data insert
            console.log('\n🎯 Attempt 3: Minimal data insert...');
            
            const minimalData = {
              org_id: 'org123',
              agent_id: 'agent456',
              message_id: 'msg789',
              channel: 'web'
            };
            
            const { data: minimalResult, error: minimalError } = await supabase
              .from('usage_events')
              .insert(minimalData)
              .select();
            
            if (minimalError) {
              console.error('❌ Minimal approach failed:', minimalError.message);
              
              // Final attempt: Check if it's a permissions issue
              console.log('\n🔐 Checking permissions with service role...');
              
              const serviceSupabase = createClient(supabaseUrl, supabaseKey);
              
              const { data: serviceResult, error: serviceError } = await serviceSupabase
                .from('usage_events')
                .insert(minimalData)
                .select();
              
              if (serviceError) {
                console.error('❌ Service role also failed:', serviceError.message);
                console.log('\n💡 This suggests a database schema or constraint issue.');
                console.log('\n📋 Recommendations:');
                console.log('  1. Check if the table actually exists in Supabase dashboard');
                console.log('  2. Verify column types match the data being inserted');
                console.log('  3. Check for any RLS policies or triggers causing the UUID comparison');
                console.log('  4. Consider running the migration manually in Supabase SQL editor');
              } else {
                console.log('✅ Service role insert successful!');
                console.log('📋 Inserted record:', serviceResult[0]);
                
                // Clean up
                await serviceSupabase
                  .from('usage_events')
                  .delete()
                  .eq('message_id', minimalData.message_id);
                console.log('🧹 Test record cleaned up');
              }
            } else {
              console.log('✅ Minimal insert successful!');
              console.log('📋 Inserted record:', minimalResult[0]);
              
              // Clean up
              await supabase
                .from('usage_events')
                .delete()
                .eq('message_id', minimalData.message_id);
              console.log('🧹 Test record cleaned up');
            }
          } else {
            console.log('✅ Upsert successful!');
            console.log('📋 Inserted record:', upsertResult[0]);
            
            // Clean up
            await supabase
              .from('usage_events')
              .delete()
              .eq('message_id', stringTestData.message_id);
            console.log('🧹 Test record cleaned up');
          }
        } else {
          console.log('✅ String approach successful!');
          console.log('📋 Inserted record:', stringResult[0]);
          
          // Clean up
          await supabase
            .from('usage_events')
            .delete()
            .eq('message_id', stringTestData.message_id);
          console.log('🧹 Test record cleaned up');
        }
      }
    } else {
      console.log('✅ Simple insert successful!');
      console.log('📋 Inserted record:', simpleResult[0]);
      
      // Clean up
      await supabase
        .from('usage_events')
        .delete()
        .eq('message_id', simpleTestData.message_id);
      console.log('🧹 Test record cleaned up');
    }
    
    // Step 4: Final verification - check existing records
    console.log('\n📊 Final verification - checking existing records...');
    
    const { data: existingRecords, error: selectError } = await supabase
      .from('usage_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (selectError) {
      console.error('❌ Failed to query existing records:', selectError.message);
    } else {
      console.log(`📋 Found ${existingRecords.length} existing records:`);
      existingRecords.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}`);
        console.log(`     Org: ${record.org_id}`);
        console.log(`     Agent: ${record.agent_id}`);
        console.log(`     Channel: ${record.channel}`);
        console.log(`     Credits: ${record.cost_credits}`);
        console.log(`     Created: ${record.created_at}`);
        console.log('');
      });
    }
    
    console.log('\n🎉 Direct SQL fix process completed!');
    
  } catch (error) {
    console.error('💥 Unexpected error in direct SQL fix:', error);
  }
}

directSQLFix();