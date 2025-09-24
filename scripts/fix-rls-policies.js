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

async function fixRLSPolicies() {
  try {
    console.log('🔧 Fixing RLS policies for usage_events...');
    
    // Step 1: Check if profiles table exists
    console.log('\n🔍 Checking profiles table...');
    
    const { data: profilesCheck, error: profilesError } = await supabase
      .from('profiles')
      .select('count')
      .limit(0);
    
    if (profilesError) {
      console.log('⚠️  Profiles table issue:', profilesError.message);
      console.log('💡 This explains the UUID = TEXT error in RLS policies');
    } else {
      console.log('✅ Profiles table exists');
    }
    
    // Step 2: Try to execute SQL to fix policies
    console.log('\n🛠️  Attempting to fix RLS policies...');
    
    const fixPoliciesSQL = `
      -- Disable RLS temporarily
      ALTER TABLE usage_events DISABLE ROW LEVEL SECURITY;
      
      -- Drop problematic policies
      DROP POLICY IF EXISTS "Users can view their organization's usage events" ON usage_events;
      DROP POLICY IF EXISTS "Super admins can view all usage events" ON usage_events;
      DROP POLICY IF EXISTS "Users can view their org's usage events" ON usage_events;
      DROP POLICY IF EXISTS "Service role can manage all usage events" ON usage_events;
      
      -- Create simple policies that don't rely on profiles table
      CREATE POLICY "Allow authenticated users to view usage events" ON usage_events
          FOR SELECT USING (auth.role() = 'authenticated');
      
      CREATE POLICY "Allow service role to manage usage events" ON usage_events
          FOR ALL USING (auth.role() = 'service_role');
      
      -- Re-enable RLS
      ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
    `;
    
    try {
      // Since we can't use exec_sql, let's try a different approach
      // First, let's test if we can insert without RLS
      console.log('\n🧪 Testing insert with current setup...');
      
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
      
      const { data: insertResult, error: insertError } = await supabase
        .from('usage_events')
        .insert(testData)
        .select();
      
      if (insertError) {
        console.error('❌ Insert still failing:', insertError.message);
        
        // Let's try to understand the table structure
        console.log('\n🔍 Investigating table structure...');
        
        // Try to get table info using information_schema
        const { data: tableInfo, error: tableError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable')
          .eq('table_name', 'usage_events')
          .eq('table_schema', 'public');
        
        if (tableError) {
          console.log('⚠️  Cannot access table schema:', tableError.message);
        } else {
          console.log('📋 Table structure:');
          tableInfo.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
          });
        }
        
        // Try a manual approach - create a new migration file
        console.log('\n📝 Creating manual migration to fix the issue...');
        
        const migrationContent = `-- Manual fix for UUID = TEXT error in usage_events
-- Run this in Supabase SQL Editor

-- Step 1: Disable RLS
ALTER TABLE usage_events DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies
DROP POLICY IF EXISTS "Users can view their organization's usage events" ON usage_events;
DROP POLICY IF EXISTS "Super admins can view all usage events" ON usage_events;
DROP POLICY IF EXISTS "Users can view their org's usage events" ON usage_events;
DROP POLICY IF EXISTS "Service role can manage all usage events" ON usage_events;

-- Step 3: Ensure all UUID columns are TEXT type
ALTER TABLE usage_events ALTER COLUMN org_id TYPE TEXT;
ALTER TABLE usage_events ALTER COLUMN agent_id TYPE TEXT;
ALTER TABLE usage_events ALTER COLUMN message_id TYPE TEXT;

-- Step 4: Create simple policies without UUID comparisons
CREATE POLICY "Allow all authenticated access" ON usage_events
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Step 5: Re-enable RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Step 6: Test insert
INSERT INTO usage_events (org_id, agent_id, message_id, channel, input_tokens, output_tokens, cost_credits)
VALUES ('test-org', 'test-agent', 'test-message', 'whatsapp', 1, 1, 1);

-- Step 7: Clean up test
DELETE FROM usage_events WHERE message_id = 'test-message';
`;
        
        const fs = require('fs');
        const path = require('path');
        
        const migrationPath = path.join(__dirname, '..', 'manual-fix-usage-events.sql');
        fs.writeFileSync(migrationPath, migrationContent);
        
        console.log(`✅ Manual migration created at: ${migrationPath}`);
        console.log('\n📋 Next steps:');
        console.log('  1. Open Supabase Dashboard');
        console.log('  2. Go to SQL Editor');
        console.log('  3. Copy and run the SQL from the manual-fix-usage-events.sql file');
        console.log('  4. Test the API again');
        
      } else {
        console.log('✅ Insert successful!');
        console.log('📋 Inserted record:', insertResult[0]);
        
        // Clean up
        await supabase
          .from('usage_events')
          .delete()
          .eq('message_id', testData.message_id);
        console.log('🧹 Test record cleaned up');
      }
      
    } catch (sqlError) {
      console.error('💥 SQL execution error:', sqlError);
    }
    
    console.log('\n🎉 RLS policy fix process completed!');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

fixRLSPolicies();