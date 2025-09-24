import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpsertAfterMigration() {
  console.log('🧪 Testing upsert operations after migration attempts...\n');

  try {
    // Get real IDs from database
    console.log('1. Getting real IDs from database:');
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

    console.log('✅ Found real IDs:');
    console.log('   org_id:', realOrgId);
    console.log('   chatbot_id:', realChatbotId);
    console.log('   device_id:', realDeviceId);

    // Check current constraint status
    console.log('\n2. Checking current external_id constraint status...');
    try {
      // Try to insert two messages with the same external_id to test uniqueness
      const testExternalId = 'constraint_test_' + Date.now();
      
      const baseMessage = {
        org_id: realOrgId,
        chatbot_id: realChatbotId,
        device_id: realDeviceId,
        phone_number: '+5511999999999',
        message_content: 'Constraint test message',
        direction: 'inbound',
        external_id: testExternalId
      };

      // First insert
      const { data: firstData, error: firstError } = await supabase
        .from('messages')
        .insert(baseMessage)
        .select('id, external_id');

      if (firstError) {
        console.error('   ❌ First insert failed:', firstError.code, firstError.message);
      } else {
        console.log('   ✅ First insert success:', firstData[0].id);
        
        // Second insert with same external_id (should fail if constraint exists)
        const { data: secondData, error: secondError } = await supabase
          .from('messages')
          .insert({
            ...baseMessage,
            message_content: 'Second message with same external_id'
          })
          .select('id, external_id');

        if (secondError && secondError.code === '23505') {
          console.log('   ✅ Unique constraint is working (duplicate rejected)');
        } else if (secondError) {
          console.log('   ⚠️ Unexpected error:', secondError.code, secondError.message);
        } else {
          console.log('   ❌ No unique constraint - duplicate was allowed:', secondData[0].id);
        }
      }
    } catch (err) {
      console.error('   💥 Exception checking constraint:', err.message);
    }

    // Test upsert operations
    console.log('\n3. Testing upsert operations...');
    
    const upsertExternalId = 'upsert_test_' + Date.now();
    const baseUpsertMessage = {
      org_id: realOrgId,
      chatbot_id: realChatbotId,
      device_id: realDeviceId,
      phone_number: '+5511999999999',
      message_content: 'Upsert test message',
      direction: 'inbound',
      external_id: upsertExternalId
    };

    // Test 1: Upsert insert
    console.log('\n   Test 1: Upsert insert...');
    try {
      const { data: upsertData, error: upsertError } = await supabase
        .from('messages')
        .upsert(baseUpsertMessage, {
          onConflict: 'external_id'
        })
        .select('id, external_id, message_content');

      if (upsertError) {
        console.error('   ❌ Upsert insert failed:', upsertError.code, upsertError.message);
        console.error('   Details:', upsertError.details);
      } else {
        console.log('   ✅ Upsert insert success:', upsertData[0].id);
        console.log('      External ID:', upsertData[0].external_id);
      }
    } catch (err) {
      console.error('   💥 Upsert insert exception:', err.message);
    }

    // Test 2: Upsert update (same external_id)
    console.log('\n   Test 2: Upsert update...');
    try {
      const { data: updateData, error: updateError } = await supabase
        .from('messages')
        .upsert({
          ...baseUpsertMessage,
          message_content: 'Updated upsert test message',
          direction: 'outbound'
        }, {
          onConflict: 'external_id'
        })
        .select('id, external_id, message_content, direction');

      if (updateError) {
        console.error('   ❌ Upsert update failed:', updateError.code, updateError.message);
        console.error('   Details:', updateError.details);
      } else {
        console.log('   ✅ Upsert update success:', updateData[0].id);
        console.log('      External ID:', updateData[0].external_id);
        console.log('      Message content:', updateData[0].message_content);
        console.log('      Direction:', updateData[0].direction);
      }
    } catch (err) {
      console.error('   💥 Upsert update exception:', err.message);
    }

    // Test 3: Test outbound message (to check UUID vs TEXT issue)
    console.log('\n4. Testing outbound message insertion...');
    try {
      const { data: outboundData, error: outboundError } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          phone_number: '+5511999999999',
          message_content: 'Outbound test message',
          direction: 'outbound',
          external_id: 'outbound_test_' + Date.now(),
          billing_status: 'pending'
        })
        .select('id, external_id, direction, billing_status');

      if (outboundError) {
        console.error('   ❌ Outbound insert failed:', outboundError.code, outboundError.message);
        console.error('   Details:', outboundError.details);
      } else {
        console.log('   ✅ Outbound insert success:', outboundData[0].id);
        console.log('      External ID:', outboundData[0].external_id);
        console.log('      Direction:', outboundData[0].direction);
        console.log('      Billing status:', outboundData[0].billing_status);
      }
    } catch (err) {
      console.error('   💥 Outbound insert exception:', err.message);
    }

    // Test 4: Webhook simulation
    console.log('\n5. Testing webhook simulation...');
    
    // Inbound webhook
    console.log('\n   Inbound webhook test...');
    try {
      const { data: webhookInData, error: webhookInError } = await supabase
        .from('messages')
        .upsert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          phone_number: '+5511999999999',
          message_content: 'Webhook inbound message',
          direction: 'inbound',
          external_id: 'webhook_in_' + Date.now(),
          contact_name: 'Test Contact',
          metadata: { webhook: true, source: 'whatsapp' }
        }, {
          onConflict: 'external_id'
        })
        .select('id, external_id, direction');

      if (webhookInError) {
        console.error('   ❌ Webhook inbound failed:', webhookInError.code, webhookInError.message);
      } else {
        console.log('   ✅ Webhook inbound success:', webhookInData[0].id);
      }
    } catch (err) {
      console.error('   💥 Webhook inbound exception:', err.message);
    }

    // Outbound webhook
    console.log('\n   Outbound webhook test...');
    try {
      const { data: webhookOutData, error: webhookOutError } = await supabase
        .from('messages')
        .upsert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          phone_number: '+5511999999999',
          message_content: 'Webhook outbound message',
          direction: 'outbound',
          external_id: 'webhook_out_' + Date.now(),
          contact_name: 'Test Contact',
          billing_status: 'pending',
          metadata: { webhook: true, source: 'api' }
        }, {
          onConflict: 'external_id'
        })
        .select('id, external_id, direction, billing_status');

      if (webhookOutError) {
        console.error('   ❌ Webhook outbound failed:', webhookOutError.code, webhookOutError.message);
        console.error('   Details:', webhookOutError.details);
      } else {
        console.log('   ✅ Webhook outbound success:', webhookOutData[0].id);
        console.log('      External ID:', webhookOutData[0].external_id);
        console.log('      Direction:', webhookOutData[0].direction);
        console.log('      Billing status:', webhookOutData[0].billing_status);
      }
    } catch (err) {
      console.error('   💥 Webhook outbound exception:', err.message);
    }

  } catch (err) {
    console.error('❌ General error:', err);
  }

  console.log('\n🏁 Upsert testing complete!');
  console.log('\n📋 Summary:');
  console.log('- Checked external_id unique constraint status');
  console.log('- Tested upsert insert and update operations');
  console.log('- Tested outbound message insertion (UUID vs TEXT issue)');
  console.log('- Tested webhook simulation for both directions');
}

testUpsertAfterMigration().catch(console.error);