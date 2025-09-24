require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeManualFix() {
  try {
    console.log('🔧 Executing manual fix for usage_events...');
    
    // Since we can't execute DDL directly, let's try a different approach
    // Let's create a completely new table with the correct structure
    
    console.log('\n🏗️  Creating new usage_events table with correct structure...');
    
    // First, let's try to insert into the existing table with a bypass approach
    console.log('\n🧪 Testing direct insert with service role...');
    
    // Create a service role client with bypass RLS
    const serviceSupabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    });
    
    const testData = {
      org_id: 'test-org-' + Date.now(),
      agent_id: 'test-agent-' + Date.now(), 
      message_id: 'test-message-' + Date.now(),
      channel: 'whatsapp',
      input_tokens: 1,
      output_tokens: 1,
      cost_credits: 1,
      meta: { test: true }
    };
    
    console.log('📝 Test data:', testData);
    
    // Try with different approaches
    const approaches = [
      { name: 'Standard insert', method: 'insert' },
      { name: 'Upsert', method: 'upsert' },
      { name: 'Raw SQL insert', method: 'rpc' }
    ];
    
    for (const approach of approaches) {
      console.log(`\n🎯 Trying ${approach.name}...`);
      
      try {
        let result, error;
        
        if (approach.method === 'insert') {
          ({ data: result, error } = await serviceSupabase
            .from('usage_events')
            .insert(testData)
            .select());
        } else if (approach.method === 'upsert') {
          ({ data: result, error } = await serviceSupabase
            .from('usage_events')
            .upsert(testData, { onConflict: 'message_id' })
            .select());
        } else if (approach.method === 'rpc') {
          // Try to create a simple RPC function for insertion
          console.log('  Creating RPC function for insertion...');
          
          const rpcFunction = `
            CREATE OR REPLACE FUNCTION insert_usage_event(
              p_org_id TEXT,
              p_agent_id TEXT,
              p_message_id TEXT,
              p_channel TEXT,
              p_input_tokens INTEGER DEFAULT 0,
              p_output_tokens INTEGER DEFAULT 0,
              p_cost_credits DECIMAL DEFAULT 0,
              p_meta JSONB DEFAULT '{}'
            )
            RETURNS TABLE(id UUID, created_at TIMESTAMPTZ) AS $$
            BEGIN
              RETURN QUERY
              INSERT INTO usage_events (org_id, agent_id, message_id, channel, input_tokens, output_tokens, cost_credits, meta)
              VALUES (p_org_id, p_agent_id, p_message_id, p_channel, p_input_tokens, p_output_tokens, p_cost_credits, p_meta)
              RETURNING usage_events.id, usage_events.created_at;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
          `;
          
          // We can't execute this directly, so skip RPC approach
          console.log('  ⚠️  Cannot create RPC function directly, skipping...');
          continue;
        }
        
        if (error) {
          console.error(`  ❌ ${approach.name} failed:`, error.message);
          
          if (error.message.includes('uuid = text')) {
            console.log('  💡 Still getting UUID = TEXT error');
          }
        } else {
          console.log(`  ✅ ${approach.name} successful!`);
          console.log('  📋 Inserted record:', result[0]);
          
          // Clean up
          const { error: deleteError } = await serviceSupabase
            .from('usage_events')
            .delete()
            .eq('message_id', testData.message_id);
          
          if (deleteError) {
            console.log('  ⚠️  Could not clean up test record:', deleteError.message);
          } else {
            console.log('  🧹 Test record cleaned up');
          }
          
          // If one approach works, we're done
          console.log('\n🎉 Found working approach! The issue may be resolved.');
          return;
        }
      } catch (approachError) {
        console.error(`  💥 ${approach.name} threw error:`, approachError.message);
      }
    }
    
    // If we get here, none of the approaches worked
    console.log('\n❌ All approaches failed. The issue requires manual intervention.');
    console.log('\n📋 Manual steps required:');
    console.log('  1. Open Supabase Dashboard');
    console.log('  2. Go to SQL Editor');
    console.log('  3. Run the following SQL:');
    console.log('');
    console.log('  -- Disable RLS temporarily');
    console.log('  ALTER TABLE usage_events DISABLE ROW LEVEL SECURITY;');
    console.log('');
    console.log('  -- Drop problematic policies');
    console.log('  DROP POLICY IF EXISTS "Users can view their organization\'s usage events" ON usage_events;');
    console.log('  DROP POLICY IF EXISTS "Super admins can view all usage events" ON usage_events;');
    console.log('');
    console.log('  -- Ensure columns are TEXT type');
    console.log('  ALTER TABLE usage_events ALTER COLUMN org_id TYPE TEXT;');
    console.log('  ALTER TABLE usage_events ALTER COLUMN agent_id TYPE TEXT;');
    console.log('  ALTER TABLE usage_events ALTER COLUMN message_id TYPE TEXT;');
    console.log('');
    console.log('  -- Create simple policy');
    console.log('  CREATE POLICY "Allow authenticated access" ON usage_events');
    console.log('      FOR ALL USING (auth.role() = \'authenticated\' OR auth.role() = \'service_role\');');
    console.log('');
    console.log('  -- Re-enable RLS');
    console.log('  ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;');
    console.log('');
    console.log('  -- Test insert');
    console.log('  INSERT INTO usage_events (org_id, agent_id, message_id, channel)');
    console.log('  VALUES (\'test-org\', \'test-agent\', \'test-message\', \'whatsapp\');');
    console.log('');
    console.log('  4. After running the SQL, test the API again with:');
    console.log('     node scripts/test-api-billing.js');
    
    console.log('\n🎉 Manual fix instructions provided!');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

executeManualFix();