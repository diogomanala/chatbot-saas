require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeUuidFix() {
  try {
    console.log('🔧 Starting UUID fix for usage_events table...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix-usage-events-uuid.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual commands (simple approach)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('--') && cmd !== 'BEGIN' && cmd !== 'COMMIT');
    
    console.log(`📝 Found ${commands.length} SQL commands to execute`);
    
    // Execute each command
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      if (!command || command.length < 5) continue;
      
      console.log(`\n⚡ Executing command ${i + 1}/${commands.length}...`);
      console.log(`📋 Command: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`);
      
      try {
        // Use rpc to execute raw SQL
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: command
        });
        
        if (error) {
          console.log(`⚠️  Command ${i + 1} failed with RPC, trying alternative method...`);
          console.log(`Error: ${error.message}`);
          
          // Try alternative method for specific commands
          if (command.includes('CREATE TABLE usage_events')) {
            console.log('🔄 Trying to create table using direct approach...');
            
            // Use fetch to execute the SQL directly
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey
              },
              body: JSON.stringify({ sql: command })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.log(`❌ Alternative method also failed: ${errorText}`);
            } else {
              console.log('✅ Alternative method succeeded');
            }
          }
        } else {
          console.log('✅ Command executed successfully');
          if (data) {
            console.log('📊 Result:', data);
          }
        }
      } catch (cmdError) {
        console.error(`❌ Command ${i + 1} failed:`, cmdError.message);
      }
    }
    
    console.log('\n🎉 UUID fix process completed!');
    
    // Test the fixed table
    console.log('\n🧪 Testing the fixed table...');
    
    const testData = {
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      agent_id: 'f99ae725-f996-483d-8813-cde922d8877a',
      message_id: 'test-uuid-fix-' + Date.now(),
      channel: 'whatsapp',
      input_tokens: 1,
      output_tokens: 1,
      cost_credits: 1,
      meta: { test: 'uuid-fix' }
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

executeUuidFix();