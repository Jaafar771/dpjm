import { supabase } from '../config/supabase.js'

export async function getCurrentAppUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authUser: null, appUser: null, appUserId: null }

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return { authUser: user, appUser: appUser || null, appUserId: user.id }
}

export async function getCurrentAppUserId() {
  const { appUserId } = await getCurrentAppUser()
  return appUserId
}
