import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixExternalIdConstraint() {
  console.log('🔧 Fixing external_id constraint issue...\n');

  // First, let's get some real IDs from the database
  console.log('1. Getting real IDs from database:');
  try {
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

    // Test 1: Simple insert without upsert
    console.log('\n2. Testing simple insert:');
    const simpleMessage = {
      org_id: realOrgId,
      chatbot_id: realChatbotId,
      device_id: realDeviceId,
      phone_number: '+5511999999999',
      message_content: 'Simple test message',
      direction: 'inbound',
      external_id: 'simple_test_' + Date.now()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('messages')
      .insert(simpleMessage)
      .select();

    if (insertError) {
      console.error('❌ Simple insert failed:', insertError);
    } else {
      console.log('✅ Simple insert successful:', insertData[0].id);
    }

    // Test 2: Try upsert with a different approach
    console.log('\n3. Testing upsert without onConflict:');
    const upsertMessage = {
      org_id: realOrgId,
      chatbot_id: realChatbotId,
      device_id: realDeviceId,
      phone_number: '+5511999999999',
      message_content: 'Upsert test message',
      direction: 'outbound',
      external_id: 'upsert_test_' + Date.now()
    };

    const { data: upsertData, error: upsertError } = await supabase
      .from('messages')
      .upsert(upsertMessage)
      .select();

    if (upsertError) {
      console.error('❌ Upsert without onConflict failed:', upsertError);
    } else {
      console.log('✅ Upsert without onConflict successful:', upsertData[0].id);
    }

    // Test 3: Check if external_id unique constraint exists
    console.log('\n4. Checking for external_id unique constraint:');
    try {
      // Try to insert duplicate external_id
      const duplicateMessage = {
        org_id: realOrgId,
        chatbot_id: realChatbotId,
        device_id: realDeviceId,
        phone_number: '+5511999999999',
        message_content: 'Duplicate test',
        direction: 'inbound',
        external_id: upsertMessage.external_id // Same external_id
      };

      const { data: dupData, error: dupError } = await supabase
        .from('messages')
        .insert(duplicateMessage)
        .select();

      if (dupError && dupError.code === '23505') {
        console.log('✅ Unique constraint exists (got expected duplicate error)');
      } else if (dupError) {
        console.log('❌ Unexpected error:', dupError);
      } else {
        console.log('⚠️ No unique constraint - duplicate was inserted!');
      }
    } catch (err) {
      console.error('❌ Exception checking constraint:', err);
    }

    // Test 4: Test the webhook approach with real data
    console.log('\n5. Testing webhook approach with real data:');
    const webhookInbound = {
      org_id: realOrgId,
      chatbot_id: realChatbotId,
      device_id: realDeviceId,
      phone_number: '+5511999999999',
      contact_name: 'Test Contact',
      message_content: 'Webhook inbound test',
      direction: 'inbound',
      external_id: 'webhook_inbound_' + Date.now(),
      metadata: {}
    };

    // Try insert first, then update if exists
    const { data: webhookData, error: webhookError } = await supabase
      .from('messages')
      .insert(webhookInbound)
      .select();

    if (webhookError) {
      console.error('❌ Webhook insert failed:', webhookError);
    } else {
      console.log('✅ Webhook insert successful:', webhookData[0].id);
    }

    const webhookOutbound = {
      org_id: realOrgId,
      chatbot_id: realChatbotId,
      device_id: realDeviceId,
      phone_number: '+5511999999999',
      contact_name: 'Test Contact',
      message_content: 'Webhook outbound test',
      direction: 'outbound',
      external_id: 'webhook_outbound_' + Date.now(),
      metadata: {}
    };

    const { data: outboundData, error: outboundError } = await supabase
      .from('messages')
      .insert(webhookOutbound)
      .select();

    if (outboundError) {
      console.error('❌ Webhook outbound failed:', outboundError);
    } else {
      console.log('✅ Webhook outbound successful:', outboundData[0].id);
    }

  } catch (err) {
    console.error('❌ General error:', err);
  }

  console.log('\n🏁 Fix attempt complete!');
}

fixExternalIdConstraint().catch(console.error);