const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRLSPolicies() {
  console.log('🔧 Fixing RLS policies for messages table...');

  try {
    // Test current access
    console.log('\n1. Testing current message access...');
    const { data: testData, error: testError } = await supabase
      .from('messages')
      .select('id, org_id, external_id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Current access error:', testError);
    } else {
      console.log('✅ Current access works, found', testData?.length || 0, 'messages');
    }

    // Try to insert a test message with external_id
    console.log('\n2. Testing message insertion with external_id...');
    const testExternalId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: insertData, error: insertError } = await supabase
      .from('messages')
      .insert({
        org_id: '76e1f14e-e96c-4bcc-8adb-a4efc9b57fda',
        chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b',
        device_id: 'a1c6497e-9211-4ffc-95fb-94a60628e9c5',
        phone_number: '5511999999999',
        message_content: 'Test message with external_id',
        direction: 'inbound',
        external_id: testExternalId,
        sender_phone: '5511999999999',
        receiver_phone: '5511888888888',
        status: 'received',
        tokens_used: 0,
        metadata: { test: true }
      })
      .select();

    if (insertError) {
      console.log('❌ Insert failed:', insertError.code, insertError.message);
      
      // If it's an RLS error, let's try to understand the current policies
      if (insertError.code === '42501') {
        console.log('\n3. RLS is blocking insertion. Checking current policies...');
        
        // Try with service role to see if we can bypass RLS
        console.log('   Attempting to query policies...');
        const { data: policies, error: policyError } = await supabase
          .rpc('exec_sql', { 
            sql: `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'messages';`
          });
        
        if (policyError) {
          console.log('   ❌ Cannot query policies:', policyError);
        } else {
          console.log('   ✅ Current policies:', policies);
        }
      }
    } else {
      console.log('✅ Insert successful:', insertData);
      
      // Clean up test message
      if (insertData && insertData.length > 0) {
        await supabase
          .from('messages')
          .delete()
          .eq('id', insertData[0].id);
        console.log('   🧹 Test message cleaned up');
      }
    }

    // Try upsert operation (which is what the webhook uses)
    console.log('\n4. Testing upsert operation...');
    const upsertExternalId = `upsert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: upsertData, error: upsertError } = await supabase
      .from('messages')
      .upsert({
        org_id: '76e1f14e-e96c-4bcc-8adb-a4efc9b57fda',
        chatbot_id: '761a8909-6674-440b-9811-7a232efb8a4b',
        device_id: 'a1c6497e-9211-4ffc-95fb-94a60628e9c5',
        phone_number: '5511999999999',
        message_content: 'Test upsert with external_id',
        direction: 'inbound',
        external_id: upsertExternalId,
        sender_phone: '5511999999999',
        receiver_phone: '5511888888888',
        status: 'received',
        tokens_used: 0,
        metadata: { test: true, upsert: true }
      }, {
        onConflict: 'external_id'
      })
      .select();

    if (upsertError) {
      console.log('❌ Upsert failed:', upsertError.code, upsertError.message);
    } else {
      console.log('✅ Upsert successful:', upsertData);
      
      // Clean up test message
      if (upsertData && upsertData.length > 0) {
        await supabase
          .from('messages')
          .delete()
          .eq('id', upsertData[0].id);
        console.log('   🧹 Test upsert message cleaned up');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }

  console.log('\n🏁 RLS policy fix test complete!');
}

fixRLSPolicies();