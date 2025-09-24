require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUsageEventsTable() {
  try {
    console.log('🔧 Creating usage_events table...');
    
    // First, let's check if the table exists
    const { data: existingTables, error: listError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'usage_events');
    
    if (listError) {
      console.log('⚠️  Could not check existing tables, proceeding with creation...');
    } else if (existingTables && existingTables.length > 0) {
      console.log('📋 Table usage_events already exists, dropping it first...');
      
      // Drop the existing table
      const dropQuery = `DROP TABLE IF EXISTS usage_events CASCADE;`;
      
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
          },
          body: JSON.stringify({ sql: dropQuery })
        });
        
        if (response.ok) {
          console.log('✅ Existing table dropped successfully');
        } else {
          console.log('⚠️  Could not drop existing table, continuing...');
        }
      } catch (dropError) {
        console.log('⚠️  Error dropping table:', dropError.message);
      }
    }
    
    // Create the table with correct UUID types
    const createTableQuery = `
      CREATE TABLE usage_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        agent_id UUID NOT NULL,
        message_id UUID NOT NULL,
        channel TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp')),
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_credits INTEGER NOT NULL DEFAULT 0,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    
    console.log('📝 Creating table with SQL...');
    
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        },
        body: JSON.stringify({ sql: createTableQuery })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Failed to create table via SQL:', errorText);
        
        // Try alternative approach - create via migrations
        console.log('🔄 Trying alternative approach...');
        
        // Let's try to create it step by step using individual queries
        const queries = [
          `CREATE TABLE IF NOT EXISTS usage_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid());`,
          `ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS org_id UUID NOT NULL;`,
          `ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS agent_id UUID NOT NULL;`,
          `ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS message_id UUID NOT NULL;`,
          `ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL;`,
          `ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS input_tokens INTEGER NOT NULL DEFAULT 0;`,
          `ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS output_tokens INTEGER NOT NULL DEFAULT 0;`,
          `ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS cost_credits INTEGER NOT NULL DEFAULT 0;`,
          `ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;`,
          `ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`
        ];
        
        for (const query of queries) {
          try {
            const stepResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey
              },
              body: JSON.stringify({ sql: query })
            });
            
            if (stepResponse.ok) {
              console.log('✅ Step completed:', query.substring(0, 50) + '...');
            } else {
              const stepError = await stepResponse.text();
              console.log('⚠️  Step failed:', stepError);
            }
          } catch (stepErr) {
            console.log('⚠️  Step error:', stepErr.message);
          }
        }
        
      } else {
        console.log('✅ Table created successfully via SQL');
      }
    } catch (createError) {
      console.error('❌ Error creating table:', createError.message);
    }
    
    // Add constraints and indexes
    const constraintQueries = [
      `ALTER TABLE usage_events ADD CONSTRAINT IF NOT EXISTS fk_usage_events_org_id FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;`,
      `ALTER TABLE usage_events ADD CONSTRAINT IF NOT EXISTS usage_events_channel_check CHECK (channel IN ('web', 'whatsapp'));`,
      `CREATE INDEX IF NOT EXISTS idx_usage_events_org_id ON usage_events(org_id);`,
      `CREATE INDEX IF NOT EXISTS idx_usage_events_agent_id ON usage_events(agent_id);`,
      `CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);`
    ];
    
    console.log('🔗 Adding constraints and indexes...');
    
    for (const query of constraintQueries) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
          },
          body: JSON.stringify({ sql: query })
        });
        
        if (response.ok) {
          console.log('✅ Constraint/Index added:', query.substring(0, 50) + '...');
        } else {
          const errorText = await response.text();
          console.log('⚠️  Constraint/Index failed:', errorText);
        }
      } catch (err) {
        console.log('⚠️  Constraint/Index error:', err.message);
      }
    }
    
    // Enable RLS and add policies
    const rlsQueries = [
      `ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;`,
      `CREATE POLICY IF NOT EXISTS "Users can view usage events from their org" ON usage_events FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.org_id = usage_events.org_id));`,
      `CREATE POLICY IF NOT EXISTS "System can insert usage events" ON usage_events FOR INSERT WITH CHECK (true);`
    ];
    
    console.log('🔒 Setting up RLS policies...');
    
    for (const query of rlsQueries) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
          },
          body: JSON.stringify({ sql: query })
        });
        
        if (response.ok) {
          console.log('✅ RLS policy added:', query.substring(0, 50) + '...');
        } else {
          const errorText = await response.text();
          console.log('⚠️  RLS policy failed:', errorText);
        }
      } catch (err) {
        console.log('⚠️  RLS policy error:', err.message);
      }
    }
    
    console.log('\n🎉 Table creation process completed!');
    
    // Test the table
    console.log('\n🧪 Testing the table...');
    
    const testData = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      agent_id: 'f99ae725-f996-483d-8813-cde922d8877a',
      message_id: 'test-' + Date.now(),
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
      console.error('❌ Test insert failed:', insertError);
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
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

createUsageEventsTable();