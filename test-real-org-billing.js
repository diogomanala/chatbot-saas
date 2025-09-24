const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://anlemekgocrrllsogxix.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFubGVtZWtnb2Nycmxsc29neGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MDEyMjMsImV4cCI6MjA3MzE3NzIyM30.7K4zVdnDh_3YuBz59PX8WoRwDxKjXJ0KXnD1tNvp7iM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealOrgBilling() {
  console.log('🔍 Testing billing with real organization ID...\n');

  try {
    // First, let's find the actual organization ID from the dashboard
    console.log('1. Finding organization from profiles...');
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, org_id, organizations(id, name)')
      .limit(5);

    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError);
      return;
    }

    console.log('📋 Found profiles:', profiles);

    if (!profiles || profiles.length === 0) {
      console.log('❌ No profiles found');
      return;
    }

    // Use the first profile's org_id
    const realOrgId = profiles[0].org_id;
    console.log(`\n2. Using real org_id: ${realOrgId}`);

    // Check current credit wallet balance
    console.log('\n3. Checking current credit wallet balance...');
    const { data: wallet, error: walletError } = await supabase
      .from('credit_wallets')
      .select('*')
      .eq('org_id', realOrgId)
      .single();

    if (walletError) {
      console.error('❌ Error fetching wallet:', walletError);
      
      // Try to create a wallet if it doesn't exist
      console.log('🔧 Creating wallet for organization...');
      const { data: newWallet, error: createError } = await supabase
        .from('credit_wallets')
        .insert({
          org_id: realOrgId,
          balance: 100, // Start with 100 credits
          currency: 'BRL'
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating wallet:', createError);
        return;
      }

      console.log('✅ Created new wallet:', newWallet);
    } else {
      console.log('💰 Current wallet balance:', wallet.balance);
    }

    // Test the debit function with correct parameters
    console.log('\n4. Testing debit_credits_simple function...');
    
    // Check wallet balance before debit
    const { data: walletBefore, error: walletBeforeError } = await supabase
      .from('credit_wallets')
      .select('balance')
      .eq('org_id', realOrgId)
      .single();

    if (walletBeforeError) {
      console.error('❌ Error fetching wallet before debit:', walletBeforeError);
    } else {
      console.log('💰 Wallet balance BEFORE debit:', walletBefore.balance);
    }

    const { data: debitResult, error: debitError } = await supabase
      .rpc('debit_credits_simple', {
        p_credits: 1,
        p_message_id: null,
        p_org_id: realOrgId
      });

    if (debitError) {
      console.error('❌ Error calling debit function:', debitError);
    } else {
      console.log('✅ Debit function result:', debitResult);
    }

    // Check balance after debit
    console.log('\n5. Checking balance after debit...');
    const { data: walletAfter, error: walletAfterError } = await supabase
      .from('credit_wallets')
      .select('balance')
      .eq('org_id', realOrgId)
      .single();

    if (walletAfterError) {
      console.error('❌ Error fetching wallet after debit:', walletAfterError);
    } else {
      console.log('💰 Wallet balance AFTER debit:', walletAfter.balance);
      
      if (walletBefore && walletAfter) {
        const difference = walletBefore.balance - walletAfter.balance;
        console.log(`📊 Credits debited: ${difference}`);
        
        if (difference === 1) {
          console.log('✅ SUCCESS: 1 credit was properly debited!');
        } else if (difference === 0) {
          console.log('❌ PROBLEM: No credits were debited from the balance!');
        } else {
          console.log(`⚠️  UNEXPECTED: ${difference} credits were debited instead of 1`);
        }
      }
    }

    // Check recent usage events
    console.log('\n6. Checking recent usage events...');
    const { data: usageEvents, error: usageError } = await supabase
      .from('usage_events')
      .select('*')
      .eq('org_id', realOrgId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (usageError) {
      console.error('❌ Error fetching usage events:', usageError);
    } else {
      console.log('📊 Recent usage events:', usageEvents);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testRealOrgBilling();