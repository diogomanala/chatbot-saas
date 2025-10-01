import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCompleteMessages() {
  console.log('🧪 Testing complete message insertion...\n');

  try {
    // Get real IDs
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
    console.log('  org_id:', realOrgId);
    console.log('  chatbot_id:', realChatbotId);
    console.log('  device_id:', realDeviceId);

    // Complete message data template
    const baseMessage = {
      org_id: realOrgId,
      chatbot_id: realChatbotId,
      device_id: realDeviceId,
      phone_number: '+5511999999999',
      message_content: 'Test message'
    };

    // Test 1: Inbound message
    console.log('\n1. Testing complete inbound message...');
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          ...baseMessage,
          direction: 'inbound',
          message_content: 'Complete inbound test'
        })
        .select('id, direction, billing_status');

      if (error) {
        console.error('   ❌ Inbound failed:', error.code, error.message);
      } else {
        console.log('   ✅ Inbound success:', data[0].id);
        console.log('      Direction:', data[0].direction);
        console.log('      Billing status:', data[0].billing_status);
      }
    } catch (err) {
      console.error('   💥 Inbound exception:', err.message);
    }

    // Test 2: Outbound message
    console.log('\n2. Testing complete outbound message...');
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          ...baseMessage,
          direction: 'outbound',
          message_content: 'Complete outbound test'
        })
        .select('id, direction, billing_status');

      if (error) {
        console.error('   ❌ Outbound failed:', error.code, error.message);
        console.error('   Details:', error.details);
      } else {
        console.log('   ✅ Outbound success:', data[0].id);
        console.log('      Direction:', data[0].direction);
        console.log('      Billing status:', data[0].billing_status);
      }
    } catch (err) {
      console.error('   💥 Outbound exception:', err.message);
    }

    // Test 3: Upsert operation
    console.log('\n3. Testing upsert operation...');
    const externalId = 'test-external-' + Date.now();
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .upsert({
          ...baseMessage,
          external_id: externalId,
          direction: 'outbound',
          message_content: 'Upsert test message'
        }, {
          onConflict: 'external_id'
        })
        .select('id, external_id, direction');

      if (error) {
        console.error('   ❌ Upsert failed:', error.code, error.message);
        console.error('   Details:', error.details);
      } else {
        console.log('   ✅ Upsert success:', data[0].id);
        console.log('      External ID:', data[0].external_id);
        console.log('      Direction:', data[0].direction);
      }
    } catch (err) {
      console.error('   💥 Upsert exception:', err.message);
    }

    // Test 4: Second upsert with same external_id (should update)
    console.log('\n4. Testing upsert update (same external_id)...');
    try {
      const { data, error } = await supabase
        .from('messages')
        .upsert({
          ...baseMessage,
          external_id: externalId,
          direction: 'outbound',
          message_content: 'Updated upsert test message'
        }, {
          onConflict: 'external_id'
        })
        .select('id, external_id, message_content');

      if (error) {
        console.error('   ❌ Upsert update failed:', error.code, error.message);
      } else {
        console.log('   ✅ Upsert update success:', data[0].id);
        console.log('      External ID:', data[0].external_id);
        console.log('      Message content:', data[0].message_content);
      }
    } catch (err) {
      console.error('   💥 Upsert update exception:', err.message);
    }

    // Test 5: Webhook simulation (inbound)
    console.log('\n5. Testing webhook simulation (inbound)...');
    try {
      const webhookData = {
        ...baseMessage,
        external_id: 'webhook-inbound-' + Date.now(),
        direction: 'inbound',
        message_content: 'Webhook inbound simulation',
        phone_number: '+5511888888888'
      };

      const { data, error } = await supabase
        .from('messages')
        .upsert(webhookData, {
          onConflict: 'external_id'
        })
        .select('id, external_id, direction, billing_status');

      if (error) {
        console.error('   ❌ Webhook inbound failed:', error.code, error.message);
      } else {
        console.log('   ✅ Webhook inbound success:', data[0].id);
        console.log('      External ID:', data[0].external_id);
        console.log('      Direction:', data[0].direction);
        console.log('      Billing status:', data[0].billing_status);
      }
    } catch (err) {
      console.error('   💥 Webhook inbound exception:', err.message);
    }

    // Test 6: Webhook simulation (outbound)
    console.log('\n6. Testing webhook simulation (outbound)...');
    try {
      const webhookData = {
        ...baseMessage,
        external_id: 'webhook-outbound-' + Date.now(),
        direction: 'outbound',
        message_content: 'Webhook outbound simulation',
        phone_number: '+5511777777777'
      };

      const { data, error } = await supabase
        .from('messages')
        .upsert(webhookData, {
          onConflict: 'external_id'
        })
        .select('id, external_id, direction, billing_status');

      if (error) {
        console.error('   ❌ Webhook outbound failed:', error.code, error.message);
      } else {
        console.log('   ✅ Webhook outbound success:', data[0].id);
        console.log('      External ID:', data[0].external_id);
        console.log('      Direction:', data[0].direction);
        console.log('      Billing status:', data[0].billing_status);
      }
    } catch (err) {
      console.error('   💥 Webhook outbound exception:', err.message);
    }

    // Test 7: Check if unique constraint is working
    console.log('\n7. Testing unique constraint on external_id...');
    const duplicateExternalId = 'duplicate-test-' + Date.now();
    
    // First insertion
    try {
      const { data: firstData, error: firstError } = await supabase
        .from('messages')
        .insert({
          ...baseMessage,
          external_id: duplicateExternalId,
          direction: 'inbound',
          message_content: 'First message with duplicate external_id'
        })
        .select('id');

      if (firstError) {
        console.error('   ❌ First insertion failed:', firstError.code, firstError.message);
      } else {
        console.log('   ✅ First insertion success:', firstData[0].id);
        
        // Second insertion (should fail due to unique constraint)
        try {
          const { data: secondData, error: secondError } = await supabase
            .from('messages')
            .insert({
              ...baseMessage,
              external_id: duplicateExternalId,
              direction: 'outbound',
              message_content: 'Second message with duplicate external_id'
            })
            .select('id');

          if (secondError) {
            console.log('   ✅ Unique constraint working - second insertion failed as expected:', secondError.code);
          } else {
            console.error('   ❌ Unique constraint NOT working - second insertion succeeded:', secondData[0].id);
          }
        } catch (err) {
          console.log('   ✅ Unique constraint working - exception thrown:', err.message);
        }
      }
    } catch (err) {
      console.error('   💥 First insertion exception:', err.message);
    }

  } catch (err) {
    console.error('❌ General error:', err);
  }

  console.log('\n🏁 Complete message testing finished!');
  console.log('\n📋 Summary:');
  console.log('- If all tests pass, the UUID vs TEXT issue is resolved');
  console.log('- Upsert operations should work correctly');
  console.log('- Webhook simulations should work for both inbound and outbound');
  console.log('- Unique constraint on external_id should prevent duplicates');
}

testCompleteMessages().catch(console.error);