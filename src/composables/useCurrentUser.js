import { onMounted, ref } from 'vue'
import { supabase } from '../config/supabase.js'

const formatNameFromEmail = (email) => {
  if (!email) return 'Mitarbeiter:in'

  return email.split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function useCurrentUser() {
  const userName = ref('Wird geladen …')

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    userName.value = user.user_metadata?.full_name
      || user.user_metadata?.name
      || formatNameFromEmail(user.email)
  }

  onMounted(loadCurrentUser)

  return { userName }
}
