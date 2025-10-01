require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsageEvents() {
  try {
    console.log('Checking recent usage events...');
    
    // Get recent usage events
    const { data: events, error } = await supabase
      .from('usage_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('Error fetching usage events:', error);
      return;
    }
    
    console.log(`Found ${events.length} recent usage events:`);
    events.forEach((event, index) => {
      console.log(`\n${index + 1}. Event ID: ${event.id}`);
      console.log(`   Org ID: ${event.org_id}`);
      console.log(`   Agent ID: ${event.agent_id}`);
      console.log(`   Message ID: ${event.message_id}`);
      console.log(`   Channel: ${event.channel}`);
      console.log(`   Input Tokens: ${event.input_tokens}`);
      console.log(`   Output Tokens: ${event.output_tokens}`);
      console.log(`   Cost Credits: ${event.cost_credits}`);
      console.log(`   Created At: ${event.created_at}`);
    });
    
    // Check table structure
    console.log('\n--- Checking table structure ---');
    const { data: columns, error: structError } = await supabase
      .rpc('get_table_columns', { table_name: 'usage_events' })
      .single();
    
    if (structError) {
      console.log('Could not get table structure via RPC, trying direct query...');
      
      // Try a simple insert to see what happens
      const testData = {
        org_id: 'test-org-id',
        agent_id: 'test-agent-id',
        message_id: 'test-message-id-' + Date.now(),
        channel: 'whatsapp', // Use valid channel value
        input_tokens: 1,
        output_tokens: 1,
        cost_credits: 1,
        meta: { test: true }
      };
      
      console.log('Testing insert with data:', testData);
      const { data: insertResult, error: insertError } = await supabase
        .from('usage_events')
        .insert(testData)
        .select();
      
      if (insertError) {
        console.error('Insert test failed:', insertError);
      } else {
        console.log('Insert test successful:', insertResult);
        
        // Clean up test record
        await supabase
          .from('usage_events')
          .delete()
          .eq('message_id', 'test-message-id');
        console.log('Test record cleaned up');
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkUsageEvents();