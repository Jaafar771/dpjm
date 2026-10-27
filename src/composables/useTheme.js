import { computed, ref } from 'vue'

const storageKey = 'dienstplan-theme'
const initialTheme = typeof window !== 'undefined'
  ? window.localStorage.getItem(storageKey) || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  : 'dark'

const theme = ref(initialTheme)

const applyTheme = (value) => {
  if (typeof document === 'undefined') return

  document.documentElement.dataset.theme = value
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'light' ? '#eff5fb' : '#08111f')
}

applyTheme(theme.value)

export function useTheme() {
  const setTheme = (value) => {
    theme.value = value === 'light' ? 'light' : 'dark'
    window.localStorage.setItem(storageKey, theme.value)
    applyTheme(theme.value)
  }

  const toggleTheme = () => setTheme(theme.value === 'dark' ? 'light' : 'dark')

  return {
    theme,
    isLightTheme: computed(() => theme.value === 'light'),
    setTheme,
    toggleTheme
  }
}
