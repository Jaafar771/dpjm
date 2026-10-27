import { createClient } from '@supabase/supabase-js'

const fallbackUrl = 'https://jbnxpqovdielnvjpijva.supabase.co'
const fallbackKey = 'sb_publishable_qav5iYo8ENePdLedfwihMw_Mt6vzjEo'

// VITE_* values are set in .env.local and override the old project values.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || fallbackUrl
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || fallbackKey

export const hasCustomSupabaseConfig = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

export const supabase = createClient(supabaseUrl, supabaseKey)
