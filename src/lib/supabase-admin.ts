// src/lib/supabase-admin.ts
import './env-setup' // DEVE ser a primeira importação
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // só no servidor
  { auth: { persistSession: false } }
);