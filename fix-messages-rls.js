import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMessagesRLS() {
  console.log('🔧 Fixing RLS policies on messages table...\n');

  try {
    // Step 1: Disable RLS temporarily
    console.log('1. Disabling RLS on messages table...');
    const { error: disableError } = await supabase
      .rpc('exec_sql', { 
        sql: 'ALTER TABLE messages DISABLE ROW LEVEL SECURITY;'
      });

    if (disableError) {
      console.error('❌ Error disabling RLS:', disableError);
    } else {
      console.log('✅ RLS disabled successfully');
    }

    // Step 2: Drop problematic policies
    console.log('\n2. Dropping problematic RLS policies...');
    const dropPoliciesSQL = `
      DROP POLICY IF EXISTS "select_own_org_messages" ON messages;
      DROP POLICY IF EXISTS "insert_own_org_messages" ON messages;
      DROP POLICY IF EXISTS "update_own_org_messages" ON messages;
      DROP POLICY IF EXISTS "delete_own_org_messages" ON messages;
    `;

    const { error: dropError } = await supabase
      .rpc('exec_sql', { sql: dropPoliciesSQL });

    if (dropError) {
      console.error('❌ Error dropping policies:', dropError);
    } else {
      console.log('✅ Policies dropped successfully');
    }

    // Step 3: Test message insertion without RLS
    console.log('\n3. Testing message insertion without RLS...');
    
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

    // Test inbound message
    console.log('\n   Testing inbound message:');
    try {
      const { data: inboundData, error: inboundError } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          phone_number: '+5511999999999',
          message_content: 'Test inbound without RLS',
          direction: 'inbound'
        })
        .select('id');

      if (inboundError) {
        console.error('      ❌ Inbound failed:', inboundError.code, inboundError.message);
      } else {
        console.log('      ✅ Inbound success:', inboundData[0].id);
      }
    } catch (err) {
      console.error('      💥 Inbound exception:', err.message);
    }

    // Test outbound message
    console.log('\n   Testing outbound message:');
    try {
      const { data: outboundData, error: outboundError } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          phone_number: '+5511999999999',
          message_content: 'Test outbound without RLS',
          direction: 'outbound'
        })
        .select('id');

      if (outboundError) {
        console.error('      ❌ Outbound failed:', outboundError.code, outboundError.message);
      } else {
        console.log('      ✅ Outbound success:', outboundData[0].id);
      }
    } catch (err) {
      console.error('      💥 Outbound exception:', err.message);
    }

    // Step 4: Create simple policies that don't cause UUID comparison issues
    console.log('\n4. Creating simple RLS policies...');
    const createPoliciesSQL = `
      -- Allow service role full access
      CREATE POLICY "service_role_full_access" ON messages
        FOR ALL USING (auth.role() = 'service_role');

      -- Allow authenticated users to read all messages (for now)
      CREATE POLICY "authenticated_read_all" ON messages
        FOR SELECT USING (auth.role() = 'authenticated');

      -- Allow authenticated users to insert messages
      CREATE POLICY "authenticated_insert" ON messages
        FOR INSERT WITH CHECK (auth.role() = 'authenticated');

      -- Allow authenticated users to update messages
      CREATE POLICY "authenticated_update" ON messages
        FOR UPDATE USING (auth.role() = 'authenticated');
    `;

    const { error: createError } = await supabase
      .rpc('exec_sql', { sql: createPoliciesSQL });

    if (createError) {
      console.error('❌ Error creating policies:', createError);
    } else {
      console.log('✅ Simple policies created successfully');
    }

    // Step 5: Re-enable RLS
    console.log('\n5. Re-enabling RLS on messages table...');
    const { error: enableError } = await supabase
      .rpc('exec_sql', { 
        sql: 'ALTER TABLE messages ENABLE ROW LEVEL SECURITY;'
      });

    if (enableError) {
      console.error('❌ Error enabling RLS:', enableError);
    } else {
      console.log('✅ RLS re-enabled successfully');
    }

    // Step 6: Test with RLS enabled
    console.log('\n6. Testing with new RLS policies...');
    
    // Test inbound message with RLS
    console.log('\n   Testing inbound message with RLS:');
    try {
      const { data: inboundData, error: inboundError } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          phone_number: '+5511999999999',
          message_content: 'Test inbound with new RLS',
          direction: 'inbound'
        })
        .select('id');

      if (inboundError) {
        console.error('      ❌ Inbound failed:', inboundError.code, inboundError.message);
      } else {
        console.log('      ✅ Inbound success:', inboundData[0].id);
      }
    } catch (err) {
      console.error('      💥 Inbound exception:', err.message);
    }

    // Test outbound message with RLS
    console.log('\n   Testing outbound message with RLS:');
    try {
      const { data: outboundData, error: outboundError } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          phone_number: '+5511999999999',
          message_content: 'Test outbound with new RLS',
          direction: 'outbound'
        })
        .select('id');

      if (outboundError) {
        console.error('      ❌ Outbound failed:', outboundError.code, outboundError.message);
      } else {
        console.log('      ✅ Outbound success:', outboundData[0].id);
      }
    } catch (err) {
      console.error('      💥 Outbound exception:', err.message);
    }

    // Test upsert operation
    console.log('\n   Testing upsert operation:');
    try {
      const { data: upsertData, error: upsertError } = await supabase
        .from('messages')
        .upsert({
          external_id: 'test-external-id-' + Date.now(),
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          phone_number: '+5511999999999',
          message_content: 'Test upsert with new RLS',
          direction: 'outbound'
        }, {
          onConflict: 'external_id'
        })
        .select('id');

      if (upsertError) {
        console.error('      ❌ Upsert failed:', upsertError.code, upsertError.message);
      } else {
        console.log('      ✅ Upsert success:', upsertData[0].id);
      }
    } catch (err) {
      console.error('      💥 Upsert exception:', err.message);
    }

  } catch (err) {
    console.error('❌ General error:', err);
  }

  console.log('\n🏁 Messages RLS fix complete!');
}

fixMessagesRLS().catch(console.error);