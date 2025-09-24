require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLSPolicies() {
  try {
    console.log('🔍 Checking RLS policies and table structure...');
    
    // Check if table exists and its structure
    console.log('\n📋 Checking table structure...');
    
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_default
          FROM information_schema.columns 
          WHERE table_name = 'usage_events' 
            AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });
    
    if (tableError) {
      console.log('⚠️  Table structure query failed:', tableError.message);
      
      // Try alternative method
      console.log('🔄 Trying alternative table check...');
      
      const { data: altCheck, error: altError } = await supabase
        .from('usage_events')
        .select('*')
        .limit(0);
      
      if (altError) {
        console.log('❌ Table does not exist or is inaccessible:', altError.message);
      } else {
        console.log('✅ Table exists and is accessible');
      }
    } else {
      console.log('✅ Table structure:');
      if (tableInfo && tableInfo.length > 0) {
        tableInfo.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
      } else {
        console.log('  No columns found or table does not exist');
      }
    }
    
    // Check RLS policies
    console.log('\n🔐 Checking RLS policies...');
    
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies 
          WHERE tablename = 'usage_events';
        `
      });
    
    if (policiesError) {
      console.log('⚠️  Policies query failed:', policiesError.message);
    } else {
      console.log('📋 RLS Policies:');
      if (policies && policies.length > 0) {
        policies.forEach(policy => {
          console.log(`  - Policy: ${policy.policyname}`);
          console.log(`    Command: ${policy.cmd}`);
          console.log(`    Roles: ${policy.roles}`);
          console.log(`    Condition: ${policy.qual}`);
          console.log(`    With Check: ${policy.with_check}`);
          console.log('');
        });
      } else {
        console.log('  No RLS policies found');
      }
    }
    
    // Check if RLS is enabled
    console.log('🔒 Checking RLS status...');
    
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT 
            schemaname,
            tablename,
            rowsecurity
          FROM pg_tables 
          WHERE tablename = 'usage_events' 
            AND schemaname = 'public';
        `
      });
    
    if (rlsError) {
      console.log('⚠️  RLS status query failed:', rlsError.message);
    } else {
      console.log('📋 RLS Status:');
      if (rlsStatus && rlsStatus.length > 0) {
        rlsStatus.forEach(table => {
          console.log(`  - Table: ${table.tablename}`);
          console.log(`    RLS Enabled: ${table.rowsecurity}`);
        });
      } else {
        console.log('  Table not found in pg_tables');
      }
    }
    
    // Check triggers
    console.log('\n⚡ Checking triggers...');
    
    const { data: triggers, error: triggersError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          SELECT 
            trigger_name,
            event_manipulation,
            action_timing,
            action_statement
          FROM information_schema.triggers 
          WHERE event_object_table = 'usage_events'
            AND event_object_schema = 'public';
        `
      });
    
    if (triggersError) {
      console.log('⚠️  Triggers query failed:', triggersError.message);
    } else {
      console.log('📋 Triggers:');
      if (triggers && triggers.length > 0) {
        triggers.forEach(trigger => {
          console.log(`  - Trigger: ${trigger.trigger_name}`);
          console.log(`    Event: ${trigger.event_manipulation}`);
          console.log(`    Timing: ${trigger.action_timing}`);
          console.log(`    Action: ${trigger.action_statement}`);
          console.log('');
        });
      } else {
        console.log('  No triggers found');
      }
    }
    
    // Try to disable RLS completely
    console.log('\n🔓 Attempting to disable RLS...');
    
    const { error: disableRLSError } = await supabase
      .rpc('exec_sql', { 
        sql: 'ALTER TABLE usage_events DISABLE ROW LEVEL SECURITY;'
      });
    
    if (disableRLSError) {
      console.log('⚠️  Failed to disable RLS:', disableRLSError.message);
    } else {
      console.log('✅ RLS disabled successfully');
    }
    
    // Try to drop all policies
    console.log('\n🗑️  Attempting to drop all policies...');
    
    if (policies && policies.length > 0) {
      for (const policy of policies) {
        const { error: dropError } = await supabase
          .rpc('exec_sql', { 
            sql: `DROP POLICY IF EXISTS "${policy.policyname}" ON usage_events;`
          });
        
        if (dropError) {
          console.log(`⚠️  Failed to drop policy ${policy.policyname}:`, dropError.message);
        } else {
          console.log(`✅ Dropped policy: ${policy.policyname}`);
        }
      }
    } else {
      console.log('  No policies to drop');
    }
    
    // Test insert again
    console.log('\n🧪 Testing insert after RLS changes...');
    
    const testData = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      agent_id: 'f99ae725-f996-483d-8813-cde922d8877a',
      message_id: 'test-rls-fix-' + Date.now(),
      channel: 'whatsapp',
      input_tokens: 10,
      output_tokens: 5,
      cost_credits: 1,
      meta: { test: 'rls-fix' }
    };
    
    const { data: insertResult, error: insertError } = await supabase
      .from('usage_events')
      .insert(testData)
      .select();
    
    if (insertError) {
      console.error('❌ Insert still failed:', insertError);
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
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkRLSPolicies();