import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const isSupabaseConfigured =
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY) &&
  !String(import.meta.env.VITE_SUPABASE_URL).includes('placeholder.supabase.co') &&
  String(import.meta.env.VITE_SUPABASE_ANON_KEY) !== 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
