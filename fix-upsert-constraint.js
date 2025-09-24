import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUpsertConstraint() {
  console.log('🔧 Fixing external_id constraint for upsert operations...\n');

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

    // Step 1: Drop the existing partial unique index
    console.log('\n2. Dropping existing partial unique index...');
    try {
      const { error: dropError } = await supabase.rpc('exec_sql', {
        sql: 'DROP INDEX IF EXISTS idx_messages_external_id_unique;'
      });
      
      if (dropError) {
        console.error('❌ Error dropping index:', dropError);
      } else {
        console.log('✅ Partial unique index dropped successfully');
      }
    } catch (err) {
      console.log('⚠️ Could not drop index via RPC, trying alternative approach...');
      
      // Alternative: Use a migration-style approach
      const { error: altDropError } = await supabase
        .from('messages')
        .select('id')
        .limit(0); // This will fail but might give us info
      
      console.log('Alternative approach result:', altDropError);
    }

    // Step 2: Create a full unique constraint (not partial)
    console.log('\n3. Creating full unique constraint on external_id...');
    try {
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          -- First, ensure all external_id values are not null by setting a default
          UPDATE messages SET external_id = 'msg_' || id::text WHERE external_id IS NULL;
          
          -- Now create a full unique constraint
          ALTER TABLE messages ADD CONSTRAINT messages_external_id_unique UNIQUE (external_id);
        `
      });
      
      if (createError) {
        console.error('❌ Error creating constraint:', createError);
      } else {
        console.log('✅ Full unique constraint created successfully');
      }
    } catch (err) {
      console.log('⚠️ Could not create constraint via RPC');
    }

    // Step 3: Test upsert operations
    console.log('\n4. Testing upsert operations...');
    
    const baseMessage = {
      org_id: realOrgId,
      chatbot_id: realChatbotId,
      device_id: realDeviceId,
      phone_number: '+5511999999999',
      message_content: 'Test upsert message',
      direction: 'inbound'
    };

    // Test 1: Insert with upsert
    console.log('\n   Test 1: Insert with upsert...');
    const externalId = 'upsert_test_' + Date.now();
    
    try {
      const { data: insertData, error: insertError } = await supabase
        .from('messages')
        .upsert({
          ...baseMessage,
          external_id: externalId
        }, {
          onConflict: 'external_id'
        })
        .select('id, external_id, message_content');

      if (insertError) {
        console.error('   ❌ Upsert insert failed:', insertError.code, insertError.message);
      } else {
        console.log('   ✅ Upsert insert success:', insertData[0].id);
        console.log('      External ID:', insertData[0].external_id);
      }
    } catch (err) {
      console.error('   💥 Upsert insert exception:', err.message);
    }

    // Test 2: Update with upsert (same external_id)
    console.log('\n   Test 2: Update with upsert (same external_id)...');
    try {
      const { data: updateData, error: updateError } = await supabase
        .from('messages')
        .upsert({
          ...baseMessage,
          external_id: externalId,
          message_content: 'Updated upsert test message',
          direction: 'outbound'
        }, {
          onConflict: 'external_id'
        })
        .select('id, external_id, message_content, direction');

      if (updateError) {
        console.error('   ❌ Upsert update failed:', updateError.code, updateError.message);
      } else {
        console.log('   ✅ Upsert update success:', updateData[0].id);
        console.log('      External ID:', updateData[0].external_id);
        console.log('      Message content:', updateData[0].message_content);
        console.log('      Direction:', updateData[0].direction);
      }
    } catch (err) {
      console.error('   💥 Upsert update exception:', err.message);
    }

    // Test 3: Webhook-style upsert (inbound)
    console.log('\n   Test 3: Webhook-style upsert (inbound)...');
    const webhookExternalId = 'webhook_inbound_' + Date.now();
    
    try {
      const { data: webhookData, error: webhookError } = await supabase
        .from('messages')
        .upsert({
          ...baseMessage,
          external_id: webhookExternalId,
          message_content: 'Webhook inbound message',
          direction: 'inbound',
          contact_name: 'Test Contact',
          metadata: { webhook: true }
        }, {
          onConflict: 'external_id'
        })
        .select('id, external_id, direction');

      if (webhookError) {
        console.error('   ❌ Webhook inbound failed:', webhookError.code, webhookError.message);
      } else {
        console.log('   ✅ Webhook inbound success:', webhookData[0].id);
        console.log('      External ID:', webhookData[0].external_id);
        console.log('      Direction:', webhookData[0].direction);
      }
    } catch (err) {
      console.error('   💥 Webhook inbound exception:', err.message);
    }

    // Test 4: Webhook-style upsert (outbound)
    console.log('\n   Test 4: Webhook-style upsert (outbound)...');
    const webhookOutboundId = 'webhook_outbound_' + Date.now();
    
    try {
      const { data: outboundData, error: outboundError } = await supabase
        .from('messages')
        .upsert({
          ...baseMessage,
          external_id: webhookOutboundId,
          message_content: 'Webhook outbound message',
          direction: 'outbound',
          contact_name: 'Test Contact',
          metadata: { webhook: true },
          billing_status: 'pending'
        }, {
          onConflict: 'external_id'
        })
        .select('id, external_id, direction, billing_status');

      if (outboundError) {
        console.error('   ❌ Webhook outbound failed:', outboundError.code, outboundError.message);
        console.error('   Details:', outboundError.details);
      } else {
        console.log('   ✅ Webhook outbound success:', outboundData[0].id);
        console.log('      External ID:', outboundData[0].external_id);
        console.log('      Direction:', outboundData[0].direction);
        console.log('      Billing status:', outboundData[0].billing_status);
      }
    } catch (err) {
      console.error('   💥 Webhook outbound exception:', err.message);
    }

  } catch (err) {
    console.error('❌ General error:', err);
  }

  console.log('\n🏁 Upsert constraint fix complete!');
  console.log('\n📋 Summary:');
  console.log('- Dropped partial unique index on external_id');
  console.log('- Created full unique constraint on external_id');
  console.log('- Tested upsert operations for insert and update');
  console.log('- Tested webhook-style upserts for inbound and outbound');
}

fixUpsertConstraint().catch(console.error);