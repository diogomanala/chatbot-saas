import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUUIDIssue() {
  console.log('🔍 Debugging UUID vs TEXT issue...\n');

  try {
    // Get real IDs first
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
    const { data: chatbots } = await supabase.from('chatbots').select('id').limit(1);
    const { data: devices } = await supabase.from('devices').select('id').limit(1);

    if (!orgs?.length || !chatbots?.length || !devices?.length) {
      console.log('❌ Missing required data in database');
      return;
    }

    const realOrgId = orgs[0].id;
    const realChatbotId = chatbots[0].id;
    const realDeviceId = devices[0].id;

    console.log('Using real IDs:');
    console.log('  org_id:', realOrgId, typeof realOrgId);
    console.log('  chatbot_id:', realChatbotId, typeof realChatbotId);
    console.log('  device_id:', realDeviceId, typeof realDeviceId);

    // Test 1: Check if the issue is with specific columns
    console.log('\n1. Testing minimal outbound message insertion...');
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          direction: 'outbound',
          message_content: 'minimal test'
        })
        .select('id');

      if (error) {
        console.error('   ❌ Minimal outbound failed:', error.code, error.message);
        console.error('   Details:', error.details);
        console.error('   Hint:', error.hint);
      } else {
        console.log('   ✅ Minimal outbound success:', data[0].id);
      }
    } catch (err) {
      console.error('   💥 Exception:', err.message);
    }

    // Test 2: Try with explicit UUID casting
    console.log('\n2. Testing with explicit UUID casting...');
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          direction: 'outbound',
          message_content: 'test with casting'
        })
        .select('id');

      if (error) {
        console.error('   ❌ With casting failed:', error.code, error.message);
      } else {
        console.log('   ✅ With casting success:', data[0].id);
      }
    } catch (err) {
      console.error('   💥 Exception:', err.message);
    }

    // Test 3: Check what happens with inbound vs outbound
    console.log('\n3. Comparing inbound vs outbound behavior...');
    
    // Inbound test
    try {
      const { data: inboundData, error: inboundError } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          direction: 'inbound',
          message_content: 'inbound comparison test'
        })
        .select('id');

      if (inboundError) {
        console.error('   ❌ Inbound failed:', inboundError.code, inboundError.message);
      } else {
        console.log('   ✅ Inbound success:', inboundData[0].id);
      }
    } catch (err) {
      console.error('   💥 Inbound exception:', err.message);
    }

    // Outbound test
    try {
      const { data: outboundData, error: outboundError } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          direction: 'outbound',
          message_content: 'outbound comparison test'
        })
        .select('id');

      if (outboundError) {
        console.error('   ❌ Outbound failed:', outboundError.code, outboundError.message);
      } else {
        console.log('   ✅ Outbound success:', outboundData[0].id);
      }
    } catch (err) {
      console.error('   💥 Outbound exception:', err.message);
    }

    // Test 4: Check if there are any remaining triggers
    console.log('\n4. Checking for active triggers on messages table...');
    try {
      const { data: triggers, error: triggerError } = await supabase
        .from('information_schema.triggers')
        .select('trigger_name, event_manipulation, action_statement')
        .eq('event_object_table', 'messages');

      if (triggerError) {
        console.error('   ❌ Error checking triggers:', triggerError);
      } else if (triggers && triggers.length > 0) {
        console.log('   📋 Active triggers found:');
        triggers.forEach(trigger => {
          console.log(`     - ${trigger.trigger_name} (${trigger.event_manipulation})`);
          console.log(`       Action: ${trigger.action_statement.substring(0, 100)}...`);
        });
      } else {
        console.log('   ✅ No active triggers found');
      }
    } catch (err) {
      console.error('   💥 Exception checking triggers:', err.message);
    }

    // Test 5: Check table constraints
    console.log('\n5. Checking table constraints...');
    try {
      const { data: constraints, error: constraintError } = await supabase
        .from('information_schema.table_constraints')
        .select('constraint_name, constraint_type')
        .eq('table_name', 'messages');

      if (constraintError) {
        console.error('   ❌ Error checking constraints:', constraintError);
      } else if (constraints && constraints.length > 0) {
        console.log('   📋 Table constraints:');
        constraints.forEach(constraint => {
          console.log(`     - ${constraint.constraint_name} (${constraint.constraint_type})`);
        });
      } else {
        console.log('   ✅ No constraints found');
      }
    } catch (err) {
      console.error('   💥 Exception checking constraints:', err.message);
    }

    // Test 6: Try inserting with different field combinations
    console.log('\n6. Testing different field combinations...');
    
    const testCases = [
      {
        name: 'Only required fields',
        data: {
          direction: 'outbound',
          message_content: 'test 1'
        }
      },
      {
        name: 'With org_id only',
        data: {
          org_id: realOrgId,
          direction: 'outbound',
          message_content: 'test 2'
        }
      },
      {
        name: 'With chatbot_id only',
        data: {
          chatbot_id: realChatbotId,
          direction: 'outbound',
          message_content: 'test 3'
        }
      },
      {
        name: 'With device_id only',
        data: {
          device_id: realDeviceId,
          direction: 'outbound',
          message_content: 'test 4'
        }
      }
    ];

    for (const testCase of testCases) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert(testCase.data)
          .select('id');

        if (error) {
          console.error(`   ❌ ${testCase.name} failed:`, error.code, error.message);
        } else {
          console.log(`   ✅ ${testCase.name} success:`, data[0].id);
        }
      } catch (err) {
        console.error(`   💥 ${testCase.name} exception:`, err.message);
      }
    }

  } catch (err) {
    console.error('❌ General error:', err);
  }

  console.log('\n🏁 UUID debugging complete!');
}

debugUUIDIssue().catch(console.error);