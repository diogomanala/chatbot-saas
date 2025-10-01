const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRLSSimple() {
  try {
    console.log('Testing simple RLS policies...');
    
    // Test basic query
    const { data, error } = await supabase
      .from('chatbots')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Data retrieved:', data);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

debugRLSSimple();