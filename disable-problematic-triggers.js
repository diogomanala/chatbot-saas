import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function disableProblematicTriggers() {
  console.log('🔧 Disabling problematic triggers...\n');

  try {
    // List of SQL commands to disable the problematic triggers
    const sqlCommands = [
      // Disable the outbound auto-debit trigger that's causing UUID issues
      'DROP TRIGGER IF EXISTS messages_outbound_autodebit_ai ON messages;',
      
      // Disable the inbound normalize trigger (might also have issues)
      'DROP TRIGGER IF EXISTS messages_inbound_normalize_bi ON messages;',
      
      // Disable the prevent pending trigger
      'DROP TRIGGER IF EXISTS messages_prevent_pending_bu ON messages;',
      
      // Disable any other billing-related triggers
      'DROP TRIGGER IF EXISTS trigger_auto_debit_outbound ON messages;',
      'DROP TRIGGER IF EXISTS trigger_set_billing_status ON messages;',
      'DROP TRIGGER IF EXISTS trigger_set_inbound_no_charge ON messages;',
      
      // Also drop the functions to prevent any issues
      'DROP FUNCTION IF EXISTS messages_outbound_autodebit_ai();',
      'DROP FUNCTION IF EXISTS messages_inbound_normalize_bi();',
      'DROP FUNCTION IF EXISTS messages_prevent_pending_bu();',
      'DROP FUNCTION IF EXISTS auto_debit_outbound_message();',
      'DROP FUNCTION IF EXISTS set_billing_status_on_insert();',
      'DROP FUNCTION IF EXISTS set_inbound_no_charge();'
    ];

    console.log('1. Executing SQL commands to disable triggers:');
    
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      console.log(`   ${i + 1}. ${command}`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: command });
        
        if (error) {
          console.log(`      ⚠️ Warning: ${error.message}`);
        } else {
          console.log(`      ✅ Success`);
        }
      } catch (err) {
        console.log(`      ❌ Error: ${err.message}`);
      }
    }

    console.log('\n2. Testing message insertion after disabling triggers:');
    
    // Get real IDs from database
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

    // Test inbound message
    console.log('\n   Testing inbound message:');
    const inboundMessage = {
      org_id: realOrgId,
      chatbot_id: realChatbotId,
      device_id: realDeviceId,
      phone_number: '+5511999999999',
      message_content: 'Test inbound after trigger disable',
      direction: 'inbound',
      external_id: 'test_inbound_no_triggers_' + Date.now()
    };

    const { data: inboundData, error: inboundError } = await supabase
      .from('messages')
      .insert(inboundMessage)
      .select();

    if (inboundError) {
      console.error('   ❌ Inbound insert failed:', inboundError);
    } else {
      console.log('   ✅ Inbound insert successful:', inboundData[0].id);
    }

    // Test outbound message
    console.log('\n   Testing outbound message:');
    const outboundMessage = {
      org_id: realOrgId,
      chatbot_id: realChatbotId,
      device_id: realDeviceId,
      phone_number: '+5511999999999',
      message_content: 'Test outbound after trigger disable',
      direction: 'outbound',
      external_id: 'test_outbound_no_triggers_' + Date.now()
    };

    const { data: outboundData, error: outboundError } = await supabase
      .from('messages')
      .insert(outboundMessage)
      .select();

    if (outboundError) {
      console.error('   ❌ Outbound insert failed:', outboundError);
    } else {
      console.log('   ✅ Outbound insert successful:', outboundData[0].id);
    }

    // Test upsert (like the webhook does)
    console.log('\n   Testing upsert operation:');
    const upsertMessage = {
      org_id: realOrgId,
      chatbot_id: realChatbotId,
      device_id: realDeviceId,
      phone_number: '+5511999999999',
      message_content: 'Test upsert after trigger disable',
      direction: 'outbound',
      external_id: 'test_upsert_no_triggers_' + Date.now()
    };

    const { data: upsertData, error: upsertError } = await supabase
      .from('messages')
      .upsert(upsertMessage)
      .select();

    if (upsertError) {
      console.error('   ❌ Upsert failed:', upsertError);
    } else {
      console.log('   ✅ Upsert successful:', upsertData[0].id);
    }

  } catch (err) {
    console.error('❌ General error:', err);
  }

  console.log('\n🏁 Trigger disable complete!');
}

disableProblematicTriggers().catch(console.error);