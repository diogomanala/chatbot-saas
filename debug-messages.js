require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key exists:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMessages() {
  try {
    console.log('\n=== CHECKING RECENT MESSAGES ===');
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, direction, tokens_used, billing_status, cost_credits, charged_at, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    console.log('Recent messages:');
    messages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.direction} | Tokens: ${msg.tokens_used} | Status: ${msg.billing_status} | Credits: ${msg.cost_credits} | Created: ${msg.created_at}`);
    });

    console.log('\n=== CHECKING BILLING STATUS SUMMARY ===');
    const { data: statusSummary, error: statusError } = await supabase
      .from('messages')
      .select('billing_status')
      .then(({ data, error }) => {
        if (error) return { data: null, error };
        const summary = data.reduce((acc, msg) => {
          acc[msg.billing_status] = (acc[msg.billing_status] || 0) + 1;
          return acc;
        }, {});
        return { data: summary, error: null };
      });

    if (statusError) {
      console.error('Error fetching status summary:', statusError);
    } else {
      console.log('Billing status summary:', statusSummary);
    }

    console.log('\n=== CHECKING ORGANIZATION CREDITS ===');
    const { data: credits, error: creditsError } = await supabase
      .from('organization_credits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (creditsError) {
      console.error('Error fetching credits:', creditsError);
    } else {
      console.log('Recent credit transactions:');
      credits.forEach((credit, i) => {
        console.log(`${i + 1}. Org: ${credit.org_id} | Balance: ${credit.balance} | Amount: ${credit.amount} | Type: ${credit.transaction_type} | Created: ${credit.created_at}`);
      });
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkMessages();