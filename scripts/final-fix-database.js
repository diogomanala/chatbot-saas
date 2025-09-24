require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function finalFixDatabase() {
  console.log('Applying final database fixes...');
  
  try {
    // Test with valid channel value
    console.log('\n--- Testing with valid data ---');
    const testData = {
      org_id: 'test-org-' + Date.now(),
      agent_id: 'test-agent',
      message_id: 'test-msg-' + Date.now(),
      channel: 'whatsapp', // Use valid channel
      input_tokens: 1,
      output_tokens: 1,
      cost_credits: 1,
      meta: { test: true }
    };
    
    // First, create a credit wallet with proper UUID
    console.log('Creating test wallet with UUID...');
    const { data: walletResult, error: walletError } = await supabase
      .from('credit_wallets')
      .insert({
        org_id: testData.org_id, // This should work if credit_wallets.org_id is TEXT
        balance: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (walletError) {
      console.log('Wallet creation failed:', walletError);
      
      // If it fails because it expects UUID, let's try with a proper UUID
      console.log('Trying with generated UUID...');
      const uuid = crypto.randomUUID();
      const { data: walletResult2, error: walletError2 } = await supabase
        .from('credit_wallets')
        .insert({
          org_id: uuid,
          balance: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (walletError2) {
        console.log('UUID wallet creation also failed:', walletError2);
      } else {
        console.log('UUID wallet created successfully');
        testData.org_id = uuid; // Use the UUID for the usage event
      }
    } else {
      console.log('Wallet created successfully with string org_id');
    }
    
    // Now try to insert usage event
    console.log('\nTesting usage event insertion...');
    const { data: insertResult, error: insertError } = await supabase
      .from('usage_events')
      .insert(testData)
      .select();
    
    if (insertError) {
      console.log('Usage event insert failed:', insertError);
      
      // Let's check what channels are allowed
      console.log('\nChecking allowed channels...');
      const channels = ['whatsapp', 'telegram', 'web', 'api', 'sms', 'email'];
      
      for (const channel of channels) {
        const testChannelData = { ...testData, channel, message_id: 'test-' + channel + '-' + Date.now() };
        const { error: channelError } = await supabase
          .from('usage_events')
          .insert(testChannelData)
          .select();
        
        if (!channelError) {
          console.log(`✓ Channel '${channel}' works`);
          // Clean up successful test
          await supabase.from('usage_events').delete().eq('message_id', testChannelData.message_id);
        } else {
          console.log(`✗ Channel '${channel}' failed:`, channelError.message);
        }
      }
      
    } else {
      console.log('✓ Usage event insert succeeded!', insertResult);
      
      // Clean up test data
      await supabase.from('usage_events').delete().eq('org_id', testData.org_id);
      console.log('Usage event cleaned up');
    }
    
    // Clean up wallet
    await supabase.from('credit_wallets').delete().eq('org_id', testData.org_id);
    console.log('Wallet cleaned up');
    
    // Final test with the actual billing service data format
    console.log('\n--- Testing with billing service format ---');
    const billingData = {
      org_id: 'org_2pqR8K9vXyZ3mN4bC1dE6fG7hJ8',
      agent_id: 'agent_abc123',
      message_id: 'msg_' + Date.now(),
      channel: 'whatsapp',
      input_tokens: 150,
      output_tokens: 75,
      cost_credits: 1,
      meta: {
        model: 'gpt-4',
        user_id: 'user_123',
        conversation_id: 'conv_456'
      }
    };
    
    // Create wallet for this org
    await supabase
      .from('credit_wallets')
      .upsert({
        org_id: billingData.org_id,
        balance: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    const { data: finalResult, error: finalError } = await supabase
      .from('usage_events')
      .insert(billingData)
      .select();
    
    if (finalError) {
      console.log('Final test failed:', finalError);
    } else {
      console.log('✓ Final test succeeded! Billing system is working.');
      
      // Check if wallet balance was updated by trigger
      const { data: updatedWallet } = await supabase
        .from('credit_wallets')
        .select('*')
        .eq('org_id', billingData.org_id)
        .single();
      
      console.log('Wallet after insert:', updatedWallet);
      
      // Clean up
      await supabase.from('usage_events').delete().eq('org_id', billingData.org_id);
      await supabase.from('credit_wallets').delete().eq('org_id', billingData.org_id);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

finalFixDatabase();