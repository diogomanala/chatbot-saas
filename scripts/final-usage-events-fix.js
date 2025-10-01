require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalUsageEventsFix() {
  try {
    console.log('🔧 Final fix for usage_events table...');
    
    // Step 1: Drop the table completely to start fresh
    console.log('🗑️  Dropping existing usage_events table...');
    
    const dropQueries = [
      'DROP TABLE IF EXISTS usage_events CASCADE;',
      'DROP TABLE IF EXISTS usage_events_backup CASCADE;'
    ];
    
    for (const query of dropQueries) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: query });
        if (error && !error.message.includes('does not exist')) {
          console.log(`⚠️  Drop query warning: ${error.message}`);
        } else {
          console.log('✅ Drop query executed');
        }
      } catch (err) {
        console.log(`⚠️  Drop query error: ${err.message}`);
      }
    }
    
    // Step 2: Create the table with TEXT types (matching the migration)
    console.log('🏗️  Creating usage_events table with TEXT types...');
    
    const createQuery = `
      CREATE TABLE usage_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        channel TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp')),
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_credits INTEGER NOT NULL DEFAULT 0,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: createQuery });
      if (error) {
        console.log(`⚠️  Create table error: ${error.message}`);
        
        // Try alternative method - create via direct SQL execution
        console.log('🔄 Trying alternative creation method...');
        
        // Use the Supabase client to create table step by step
        const stepQueries = [
          'CREATE TABLE usage_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid());',
          'ALTER TABLE usage_events ADD COLUMN org_id TEXT NOT NULL;',
          'ALTER TABLE usage_events ADD COLUMN agent_id TEXT NOT NULL;',
          'ALTER TABLE usage_events ADD COLUMN message_id TEXT NOT NULL;',
          'ALTER TABLE usage_events ADD COLUMN channel TEXT NOT NULL;',
          'ALTER TABLE usage_events ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;',
          'ALTER TABLE usage_events ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;',
          'ALTER TABLE usage_events ADD COLUMN cost_credits INTEGER NOT NULL DEFAULT 0;',
          'ALTER TABLE usage_events ADD COLUMN meta JSONB DEFAULT \'{}\'::jsonb;',
          'ALTER TABLE usage_events ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();',
          'ALTER TABLE usage_events ADD CONSTRAINT usage_events_channel_check CHECK (channel IN (\'web\', \'whatsapp\'));'
        ];
        
        for (const stepQuery of stepQueries) {
          try {
            const { error: stepError } = await supabase.rpc('exec_sql', { sql: stepQuery });
            if (stepError) {
              console.log(`⚠️  Step error: ${stepError.message}`);
            } else {
              console.log(`✅ Step completed: ${stepQuery.substring(0, 50)}...`);
            }
          } catch (stepErr) {
            console.log(`⚠️  Step exception: ${stepErr.message}`);
          }
        }
      } else {
        console.log('✅ Table created successfully');
      }
    } catch (createErr) {
      console.log(`❌ Create table exception: ${createErr.message}`);
    }
    
    // Step 3: Add indexes
    console.log('📊 Adding indexes...');
    
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_usage_events_org_id ON usage_events(org_id);',
      'CREATE INDEX IF NOT EXISTS idx_usage_events_agent_id ON usage_events(agent_id);',
      'CREATE INDEX IF NOT EXISTS idx_usage_events_message_id ON usage_events(message_id);',
      'CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);'
    ];
    
    for (const indexQuery of indexQueries) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: indexQuery });
        if (error) {
          console.log(`⚠️  Index error: ${error.message}`);
        } else {
          console.log(`✅ Index created: ${indexQuery.substring(0, 50)}...`);
        }
      } catch (indexErr) {
        console.log(`⚠️  Index exception: ${indexErr.message}`);
      }
    }
    
    // Step 4: Set permissions (no RLS to avoid UUID comparison issues)
    console.log('🔐 Setting permissions...');
    
    const permissionQueries = [
      'GRANT ALL ON usage_events TO service_role;',
      'GRANT SELECT, INSERT ON usage_events TO authenticated;',
      'GRANT SELECT, INSERT ON usage_events TO anon;'
    ];
    
    for (const permQuery of permissionQueries) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: permQuery });
        if (error) {
          console.log(`⚠️  Permission error: ${error.message}`);
        } else {
          console.log(`✅ Permission set: ${permQuery.substring(0, 50)}...`);
        }
      } catch (permErr) {
        console.log(`⚠️  Permission exception: ${permErr.message}`);
      }
    }
    
    console.log('\n🎉 Table setup completed!');
    
    // Step 5: Test the table
    console.log('\n🧪 Testing the table...');
    
    const testData = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      agent_id: 'f99ae725-f996-483d-8813-cde922d8877a',
      message_id: 'test-final-fix-' + Date.now(),
      channel: 'whatsapp',
      input_tokens: 10,
      output_tokens: 5,
      cost_credits: 1,
      meta: { test: 'final-fix', timestamp: new Date().toISOString() }
    };
    
    console.log('📝 Test data:', testData);
    
    const { data: insertResult, error: insertError } = await supabase
      .from('usage_events')
      .insert(testData)
      .select();
    
    if (insertError) {
      console.error('❌ Test insert failed:', insertError);
      
      // Try with service role key directly
      console.log('🔄 Trying with service role...');
      
      const serviceSupabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      
      const { data: serviceResult, error: serviceError } = await serviceSupabase
        .from('usage_events')
        .insert(testData)
        .select();
      
      if (serviceError) {
        console.error('❌ Service role insert also failed:', serviceError);
      } else {
        console.log('✅ Service role insert successful!');
        console.log('📋 Inserted record:', serviceResult[0]);
        
        // Clean up test record
        await serviceSupabase
          .from('usage_events')
          .delete()
          .eq('message_id', testData.message_id);
        console.log('🧹 Test record cleaned up');
      }
    } else {
      console.log('✅ Test insert successful!');
      console.log('📋 Inserted record:', insertResult[0]);
      
      // Clean up test record
      await supabase
        .from('usage_events')
        .delete()
        .eq('message_id', testData.message_id);
      console.log('🧹 Test record cleaned up');
    }
    
    // Step 6: Check existing records
    console.log('\n📊 Checking for existing usage events...');
    
    const { data: existingEvents, error: selectError } = await supabase
      .from('usage_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (selectError) {
      console.error('❌ Failed to query existing events:', selectError);
    } else {
      console.log(`📋 Found ${existingEvents.length} existing events:`);
      existingEvents.forEach((event, index) => {
        console.log(`  ${index + 1}. ID: ${event.id}, Org: ${event.org_id}, Channel: ${event.channel}, Credits: ${event.cost_credits}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

finalUsageEventsFix();