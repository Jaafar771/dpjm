import { computed, onMounted, ref } from 'vue'
import { supabase } from '../config/supabase.js'

const formatNameFromEmail = (email) => {
  if (!email) return 'Mitarbeiter:in'

  return email.split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const formatNameFromUsername = (username) => (username || '')
  .split(/[._-]/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ')

export function useCurrentUser() {
  const userName = ref('Wird geladen …')
  const appUser = ref(null)
  const authRole = ref('employee')

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // The username login resolves app_users.id to auth.users.id in the Edge
    // Function. Load that same row in the app so the displayed identity also
    // comes from app_users instead of only from optional Auth metadata.
    const { data } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    appUser.value = data || null
    authRole.value = data?.role || user.app_metadata?.role || 'employee'
    userName.value = data?.full_name
      || data?.name
      || data?.display_name
      || formatNameFromUsername(data?.username)
      || user.user_metadata?.full_name
      || user.user_metadata?.name
      || formatNameFromEmail(user.email)
  }

  onMounted(loadCurrentUser)

  return { userName, appUser, isAdmin: computed(() => authRole.value === 'admin'), loadCurrentUser }
}
