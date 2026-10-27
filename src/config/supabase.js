import { createClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

// Vite only injects VITE_* values at build time. In particular, Vercel needs
// the same two values in its project environment settings as local development.
export const hasCustomSupabaseConfig = Boolean(configuredUrl && configuredKey)

// Do not silently send production logins to a retired project when a hosting
// environment is not configured. The placeholder only allows the UI to render
// its setup message; no credentials are sent to it.
const supabaseUrl = configuredUrl || 'https://supabase-not-configured.invalid'
const supabaseKey = configuredKey || 'not-configured-public-key'

export const supabase = createClient(supabaseUrl, supabaseKey)
