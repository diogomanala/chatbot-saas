import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateUuidIssue() {
  console.log('🔍 Investigating UUID type casting issue...\n');

  try {
    // 1. Check table structure
    console.log('1. Checking messages table structure:');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, udt_name, column_default, is_nullable')
      .eq('table_name', 'messages')
      .eq('table_schema', 'public')
      .order('ordinal_position');

    if (columnsError) {
      console.error('❌ Error getting columns:', columnsError);
    } else {
      console.table(columns);
    }

    // 2. Check RLS policies
    console.log('\n2. Checking RLS policies on messages table:');
    try {
      const { data: policies, error: policiesError } = await supabase
        .rpc('sql', { 
          query: `
            SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
            FROM pg_policies 
            WHERE tablename = 'messages';
          `
        });

      if (policiesError) {
        console.error('❌ Error getting policies:', policiesError);
      } else {
        console.log('RLS Policies:');
        console.table(policies);
      }
    } catch (err) {
      console.log('⚠️ Could not check RLS policies via rpc');
    }

    // 3. Check constraints
    console.log('\n3. Checking table constraints:');
    try {
      const { data: constraints, error: constraintsError } = await supabase
        .from('information_schema.table_constraints')
        .select('constraint_name, constraint_type')
        .eq('table_name', 'messages')
        .eq('table_schema', 'public');

      if (constraintsError) {
        console.error('❌ Error getting constraints:', constraintsError);
      } else {
        console.log('Table constraints:');
        console.table(constraints);
      }
    } catch (err) {
      console.log('⚠️ Could not check constraints');
    }

    // 4. Try different insertion approaches
    console.log('\n4. Testing different insertion approaches:');
    
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

    // Test A: Minimal outbound message
    console.log('\n   A. Testing minimal outbound message:');
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          phone_number: '+5511999999999',
          message_content: 'Minimal test',
          direction: 'outbound'
        })
        .select('id');

      if (error) {
        console.error('      ❌ Failed:', error.code, error.message);
      } else {
        console.log('      ✅ Success:', data[0].id);
      }
    } catch (err) {
      console.error('      💥 Exception:', err.message);
    }

    // Test B: With explicit type casting
    console.log('\n   B. Testing with explicit UUID casting:');
    try {
      const { data, error } = await supabase
        .rpc('sql', {
          query: `
            INSERT INTO messages (org_id, chatbot_id, device_id, phone_number, message_content, direction)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
            RETURNING id;
          `,
          params: [realOrgId, realChatbotId, realDeviceId, '+5511999999999', 'Cast test', 'outbound']
        });

      if (error) {
        console.error('      ❌ Failed:', error.code, error.message);
      } else {
        console.log('      ✅ Success with casting');
      }
    } catch (err) {
      console.error('      💥 Exception:', err.message);
    }

    // Test C: Disable RLS temporarily
    console.log('\n   C. Testing with RLS disabled:');
    try {
      // First disable RLS
      await supabase.rpc('sql', { query: 'ALTER TABLE messages DISABLE ROW LEVEL SECURITY;' });
      
      const { data, error } = await supabase
        .from('messages')
        .insert({
          org_id: realOrgId,
          chatbot_id: realChatbotId,
          device_id: realDeviceId,
          phone_number: '+5511999999999',
          message_content: 'RLS disabled test',
          direction: 'outbound'
        })
        .select('id');

      if (error) {
        console.error('      ❌ Failed even with RLS disabled:', error.code, error.message);
      } else {
        console.log('      ✅ Success with RLS disabled:', data[0].id);
      }

      // Re-enable RLS
      await supabase.rpc('sql', { query: 'ALTER TABLE messages ENABLE ROW LEVEL SECURITY;' });
      
    } catch (err) {
      console.error('      💥 Exception:', err.message);
    }

  } catch (err) {
    console.error('❌ General error:', err);
  }

  console.log('\n🏁 Investigation complete!');
}

investigateUuidIssue().catch(console.error);