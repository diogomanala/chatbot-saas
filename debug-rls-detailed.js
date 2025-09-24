const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRLSDetailed() {
  try {
    console.log('Testing RLS policies...');
    
    // Test public access
    const { data: publicData, error: publicError } = await supabase
      .from('chatbots')
      .select('*')
      .limit(5);
    
    if (publicError) {
      console.error('Public access error:', publicError);
    } else {
      console.log('Public data:', publicData);
    }
    
    // Test authenticated access (if user is logged in)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      console.log('User authenticated:', user.id);
      
      const { data: userChatbots, error: userError } = await supabase
        .from('chatbots')
        .select('*')
        .eq('user_id', user.id);
      
      if (userError) {
        console.error('User chatbots error:', userError);
      } else {
        console.log('User chatbots:', userChatbots);
      }
    } else {
      console.log('No user authenticated');
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

debugRLSDetailed();