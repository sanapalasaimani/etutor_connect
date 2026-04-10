import { createClient } from '@supabase/supabase-js'

// These "import.meta.env" lines look for your .env file automatically
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)