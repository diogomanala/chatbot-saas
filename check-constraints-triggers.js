const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkConstraintsAndTriggers() {
  console.log('🔍 Checking constraints, triggers, and indexes on credit_wallets...');
  
  try {
    // Check constraints
    console.log('\n📋 Checking constraints...');
    const { data: constraints, error: constraintsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          conname as constraint_name,
          contype as constraint_type,
          pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint 
        WHERE conrelid = 'credit_wallets'::regclass;
      `
    });
    
    if (constraintsError) {
      console.error('❌ Error checking constraints:', constraintsError);
    } else {
      console.log('Constraints:', constraints);
    }
    
    // Check triggers
    console.log('\n🔥 Checking triggers...');
    const { data: triggers, error: triggersError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          tgname as trigger_name,
          tgtype as trigger_type,
          proname as function_name,
          pg_get_triggerdef(t.oid) as trigger_definition
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE t.tgrelid = 'credit_wallets'::regclass
        AND NOT t.tgisinternal;
      `
    });
    
    if (triggersError) {
      console.error('❌ Error checking triggers:', triggersError);
    } else {
      console.log('Triggers:', triggers);
    }
    
    // Check indexes
    console.log('\n📊 Checking indexes...');
    const { data: indexes, error: indexesError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename = 'credit_wallets';
      `
    });
    
    if (indexesError) {
      console.error('❌ Error checking indexes:', indexesError);
    } else {
      console.log('Indexes:', indexes);
    }
    
    // Check RLS policies
    console.log('\n🔒 Checking RLS policies...');
    const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          polname as policy_name,
          polcmd as policy_command,
          polqual as policy_qual,
          polwithcheck as policy_with_check
        FROM pg_policy 
        WHERE polrelid = 'credit_wallets'::regclass;
      `
    });
    
    if (policiesError) {
      console.error('❌ Error checking policies:', policiesError);
    } else {
      console.log('RLS Policies:', policies);
    }
    
  } catch (err) {
    console.error('❌ Exception:', err.message);
    
    // Fallback: try to get basic table info
    console.log('\n🔄 Trying alternative approach...');
    
    try {
      // Check if there are any foreign key references
      const { data: fkData, error: fkError } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
          AND (tc.table_name = 'credit_wallets' OR ccu.table_name = 'credit_wallets');
        `
      });
      
      if (fkError) {
        console.error('❌ Error checking foreign keys:', fkError);
      } else {
        console.log('Foreign Keys:', fkData);
      }
      
    } catch (altErr) {
      console.error('❌ Alternative approach failed:', altErr.message);
    }
  }
}

checkConstraintsAndTriggers().catch(console.error);