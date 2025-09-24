const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'
);

async function debugDevices() {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .limit(10);
    
    if (error) {
      console.error('Error fetching devices:', error);
    } else {
      console.log('Devices:', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

debugDevices();