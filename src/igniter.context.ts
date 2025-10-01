import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * @description Create the context of the Igniter.js application
 * @see https://github.com/felipebarcelospro/igniter-js
 */
export const createIgniterAppContext = () => {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  // Create admin client only on server-side
  let supabaseAdmin = null
  if (typeof window === 'undefined') {
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  
  return {
    supabase,
    supabaseAdmin,
  }
}

/**
 * @description The context of the Igniter.js application
 * @see https://github.com/felipebarcelospro/igniter-js
 */
export type IgniterAppContext = Awaited<ReturnType<typeof createIgniterAppContext>>