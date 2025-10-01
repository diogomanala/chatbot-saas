import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMessagesIssue() {
  console.log('🔍 Debugging messages table issue...\n');

  // Test 1: Check if we can query the messages table
  console.log('1. Testing basic query on messages table:');
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, direction, created_at')
      .limit(5);
    
    if (error) {
      console.error('❌ Error querying messages:', error);
    } else {
      console.log('✅ Query successful, found', data.length, 'messages');
      console.log('Sample data:', data);
    }
  } catch (err) {
    console.error('❌ Exception querying messages:', err);
  }

  console.log('\n2. Testing insert without specifying ID (should auto-generate):');
  try {
    const testData = {
      org_id: '550e8400-e29b-41d4-a716-446655440000',
      chatbot_id: '550e8400-e29b-41d4-a716-446655440001', 
      device_id: '550e8400-e29b-41d4-a716-446655440002',
      phone_number: '+5511999999999',
      message_content: 'Test message without ID',
      direction: 'inbound'
    };

    const { data, error } = await supabase
      .from('messages')
      .insert(testData)
      .select();

    if (error) {
      console.error('❌ Error inserting without ID:', error);
    } else {
      console.log('✅ Insert without ID successful:', data);
    }
  } catch (err) {
    console.error('❌ Exception inserting without ID:', err);
  }

  console.log('\n3. Testing insert with explicit UUID:');
  try {
    const testData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      org_id: '550e8400-e29b-41d4-a716-446655440000',
      chatbot_id: '550e8400-e29b-41d4-a716-446655440001', 
      device_id: '550e8400-e29b-41d4-a716-446655440002',
      phone_number: '+5511999999999',
      message_content: 'Test message with explicit UUID',
      direction: 'outbound'
    };

    const { data, error } = await supabase
      .from('messages')
      .insert(testData)
      .select();

    if (error) {
      console.error('❌ Error inserting with UUID:', error);
    } else {
      console.log('✅ Insert with UUID successful:', data);
    }
  } catch (err) {
    console.error('❌ Exception inserting with UUID:', err);
  }

  console.log('\n4. Testing upsert (like the webhook does):');
  try {
    const testData = {
      org_id: '550e8400-e29b-41d4-a716-446655440000',
      chatbot_id: '550e8400-e29b-41d4-a716-446655440001', 
      device_id: '550e8400-e29b-41d4-a716-446655440002',
      phone_number: '+5511999999999',
      message_content: 'Test upsert message',
      direction: 'outbound',
      external_id: 'test_upsert_' + Date.now()
    };

    const { data, error } = await supabase
      .from('messages')
      .upsert(testData, { 
        onConflict: 'external_id',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('❌ Error with upsert:', error);
    } else {
      console.log('✅ Upsert successful:', data);
    }
  } catch (err) {
    console.error('❌ Exception with upsert:', err);
  }

  console.log('\n5. Testing the exact webhook scenario:');
  try {
    // Simulate exactly what the webhook does
    const inboundMessage = {
      org_id: '550e8400-e29b-41d4-a716-446655440000',
      chatbot_id: '550e8400-e29b-41d4-a716-446655440001',
      device_id: '550e8400-e29b-41d4-a716-446655440002',
      phone_number: '+5511999999999',
      contact_name: 'Test Contact',
      message_content: 'Hello from webhook test',
      direction: 'inbound',
      external_id: 'webhook_test_inbound_' + Date.now(),
      metadata: {}
    };

    const { data: inboundData, error: inboundError } = await supabase
      .from('messages')
      .upsert(inboundMessage, { 
        onConflict: 'external_id',
        ignoreDuplicates: false 
      })
      .select();

    if (inboundError) {
      console.error('❌ Error with webhook inbound:', inboundError);
    } else {
      console.log('✅ Webhook inbound successful:', inboundData);
    }

    // Test outbound
    const outboundMessage = {
      org_id: '550e8400-e29b-41d4-a716-446655440000',
      chatbot_id: '550e8400-e29b-41d4-a716-446655440001',
      device_id: '550e8400-e29b-41d4-a716-446655440002',
      phone_number: '+5511999999999',
      contact_name: 'Test Contact',
      message_content: 'Response from webhook test',
      direction: 'outbound',
      external_id: 'webhook_test_outbound_' + Date.now(),
      metadata: {}
    };

    const { data: outboundData, error: outboundError } = await supabase
      .from('messages')
      .upsert(outboundMessage, { 
        onConflict: 'external_id',
        ignoreDuplicates: false 
      })
      .select();

    if (outboundError) {
      console.error('❌ Error with webhook outbound:', outboundError);
    } else {
      console.log('✅ Webhook outbound successful:', outboundData);
    }

  } catch (err) {
    console.error('❌ Exception with webhook scenario:', err);
  }

  console.log('\n🏁 Debug complete!');
}

debugMessagesIssue().catch(console.error);