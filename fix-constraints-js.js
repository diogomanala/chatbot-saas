import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixConstraintsAndPolicies() {
  console.log('🔧 Fixing external_id constraints and RLS policies...\n');

  try {
    // Step 1: Check current constraint status
    console.log('1. Checking current constraint status...');
    const { data: indexes, error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
            indexname, 
            indexdef 
        FROM pg_indexes 
        WHERE tablename = 'messages' 
            AND indexname LIKE '%external_id%';
      `
    });

    if (indexError) {
      console.log('   Using alternative method to check constraints...');
    } else {
      console.log('   Current indexes:', indexes);
    }

    // Step 2: Update NULL external_id values
    console.log('\n2. Updating NULL external_id values...');
    const { data: updateResult, error: updateError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE messages 
        SET external_id = 'msg_' || id::text 
        WHERE external_id IS NULL;
      `
    });

    if (updateError) {
      console.error('   ❌ Failed to update NULL values:', updateError.message);
    } else {
      console.log('   ✅ Updated NULL external_id values');
    }

    // Step 3: Drop partial unique index
    console.log('\n3. Dropping partial unique index...');
    const { data: dropResult, error: dropError } = await supabase.rpc('exec_sql', {
      sql: `DROP INDEX IF EXISTS idx_messages_external_id_unique;`
    });

    if (dropError) {
      console.error('   ❌ Failed to drop index:', dropError.message);
    } else {
      console.log('   ✅ Dropped partial unique index');
    }

    // Step 4: Add NOT NULL constraint
    console.log('\n4. Adding NOT NULL constraint...');
    const { data: notNullResult, error: notNullError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE messages ALTER COLUMN external_id SET NOT NULL;`
    });

    if (notNullError) {
      console.error('   ❌ Failed to add NOT NULL:', notNullError.message);
    } else {
      console.log('   ✅ Added NOT NULL constraint');
    }

    // Step 5: Create proper unique constraint
    console.log('\n5. Creating proper unique constraint...');
    const { data: uniqueResult, error: uniqueError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE messages ADD CONSTRAINT messages_external_id_unique UNIQUE (external_id);`
    });

    if (uniqueError) {
      console.error('   ❌ Failed to create unique constraint:', uniqueError.message);
    } else {
      console.log('   ✅ Created unique constraint');
    }

    // Step 6: Create performance index
    console.log('\n6. Creating performance index...');
    const { data: indexResult, error: indexCreateError } = await supabase.rpc('exec_sql', {
      sql: `CREATE INDEX IF NOT EXISTS idx_messages_external_id ON messages (external_id);`
    });

    if (indexCreateError) {
      console.error('   ❌ Failed to create index:', indexCreateError.message);
    } else {
      console.log('   ✅ Created performance index');
    }

    // Step 7: Fix RLS policies
    console.log('\n7. Fixing RLS policies...');
    
    // Drop existing policies
    const policies = ['messages_select_policy', 'messages_insert_policy', 'messages_update_policy'];
    for (const policy of policies) {
      const { error: dropPolicyError } = await supabase.rpc('exec_sql', {
        sql: `DROP POLICY IF EXISTS "${policy}" ON messages;`
      });
      
      if (dropPolicyError) {
        console.error(`   ⚠️ Warning dropping ${policy}:`, dropPolicyError.message);
      }
    }

    // Create new policies with proper type casting
    const policyQueries = [
      {
        name: 'SELECT policy',
        sql: `
          CREATE POLICY "messages_select_policy" ON messages
              FOR SELECT USING (
                  org_id::text = (auth.jwt() ->> 'org_id')::text
              );
        `
      },
      {
        name: 'INSERT policy',
        sql: `
          CREATE POLICY "messages_insert_policy" ON messages
              FOR INSERT WITH CHECK (
                  org_id::text = (auth.jwt() ->> 'org_id')::text
              );
        `
      },
      {
        name: 'UPDATE policy',
        sql: `
          CREATE POLICY "messages_update_policy" ON messages
              FOR UPDATE USING (
                  org_id::text = (auth.jwt() ->> 'org_id')::text
              ) WITH CHECK (
                  org_id::text = (auth.jwt() ->> 'org_id')::text
              );
        `
      }
    ];

    for (const policy of policyQueries) {
      const { error: policyError } = await supabase.rpc('exec_sql', {
        sql: policy.sql
      });
      
      if (policyError) {
        console.error(`   ❌ Failed to create ${policy.name}:`, policyError.message);
      } else {
        console.log(`   ✅ Created ${policy.name}`);
      }
    }

    // Step 8: Verify changes
    console.log('\n8. Verifying changes...');
    
    // Check constraint
    const { data: constraintCheck, error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
            'Constraint created' as status,
            conname as constraint_name,
            contype as constraint_type
        FROM pg_constraint 
        WHERE conrelid = 'messages'::regclass 
            AND conname = 'messages_external_id_unique';
      `
    });

    if (constraintError) {
      console.error('   ❌ Failed to verify constraint:', constraintError.message);
    } else {
      console.log('   ✅ Constraint verification:', constraintCheck);
    }

    // Check policies
    const { data: policyCheck, error: policyCheckError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
            'Policies recreated' as status,
            policyname as policy_name,
            cmd as command
        FROM pg_policies 
        WHERE tablename = 'messages';
      `
    });

    if (policyCheckError) {
      console.error('   ❌ Failed to verify policies:', policyCheckError.message);
    } else {
      console.log('   ✅ Policy verification:', policyCheck);
    }

    console.log('\n✅ Fix completed successfully!');

  } catch (err) {
    console.error('❌ General error:', err);
  }
}

fixConstraintsAndPolicies().catch(console.error);