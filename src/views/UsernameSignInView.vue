<template>
  <main class="sign-in-page">
    <section class="sign-in-intro">
      <router-link to="/" class="intro-brand"><span><i class="fa-solid fa-calendar-check"></i></span><strong>Dienstplan</strong></router-link>
      <div class="intro-copy"><p>Einfach organisiert</p><h1>Dein Dienst.<br><em>Ein Ort.</em></h1><span>Behalte Schichten, Anträge und wichtige Informationen immer im Blick.</span><div class="intro-status"><span><i class="fa-solid fa-calendar-days"></i> Dienstplan live</span><span><i class="fa-solid fa-bell"></i> Updates im Blick</span></div></div>
      <div class="intro-dots"><i></i><i></i><i></i></div>
    </section>
    <section class="sign-in-content">
      <div class="sign-in-card">
        <div class="card-heading"><span class="mobile-logo"><i class="fa-solid fa-calendar-check"></i></span><p>Willkommen zurück</p><h2>Anmelden</h2><span>Melde dich mit deinem Benutzernamen und Passwort an.</span></div>
        <p v-if="!hasCustomSupabaseConfig" class="setup-note" role="status"><i class="fa-solid fa-triangle-exclamation"></i>Die Online-Anmeldung muss für diese Bereitstellung noch eingerichtet werden.</p>
        <p v-if="errorMessage" class="error" role="alert"><i class="fa-solid fa-circle-exclamation"></i>{{ errorMessage }}</p>
        <form @submit.prevent="handleLogin">
          <label><span>Benutzername</span><div><i class="fa-regular fa-user"></i><input v-model.trim="username" type="text" autocomplete="username" placeholder="Dein Benutzername" minlength="3" maxlength="64" required></div></label>
          <label><span>Passwort</span><div><i class="fa-solid fa-lock"></i><input v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="••••••••" required><button type="button" :aria-label="showPassword ? 'Passwort ausblenden' : 'Passwort anzeigen'" @click="showPassword = !showPassword"><i class="fa-solid" :class="showPassword ? 'fa-eye-slash' : 'fa-eye'"></i></button></div></label>
          <button class="login-button" type="submit" :disabled="isLoading"><i class="fa-solid" :class="isLoading ? 'fa-spinner fa-spin' : 'fa-arrow-right'"></i>{{ isLoading ? 'Wird angemeldet …' : 'Anmelden' }}</button>
        </form>
        <div class="login-assurance"><span><i class="fa-solid fa-shield-heart"></i> Persönlicher Zugang</span><span><i class="fa-solid fa-mobile-screen-button"></i> Für Handy &amp; PC</span></div>
        <p class="help-copy"><i class="fa-regular fa-circle-question"></i>Probleme beim Anmelden? Bitte wende dich an die Dienstplan-Verwaltung.</p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { hasCustomSupabaseConfig, supabase } from '../config/supabase.js'

const router = useRouter()
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  errorMessage.value = ''
  isLoading.value = true
  try {
    const { data, error: functionError } = await supabase.functions.invoke('login-by-username', { body: { username: username.value, password: password.value } })
    if (functionError) throw functionError
    if (!data?.session?.access_token || !data.session.refresh_token) throw new Error('Invalid credentials.')
    const { error } = await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
    if (error) throw error
    const redirect = router.currentRoute.value.query.redirect
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from('app_users').select('role').eq('id', user.id).maybeSingle()
      : { data: null }
    const defaultRoute = profile?.role === 'admin' || user?.app_metadata?.role === 'admin' ? '/admin' : '/home'
    router.replace(typeof redirect === 'string' && redirect.startsWith('/') ? redirect : defaultRoute)
  } catch (error) {
    const details = `${error?.message || ''} ${error?.context?.message || ''}`.toLowerCase()
    if (details.includes('fetch') || details.includes('network') || details.includes('function')) {
      errorMessage.value = hasCustomSupabaseConfig
        ? 'Der Anmeldedienst ist derzeit nicht erreichbar. Bitte prüfe deine Internetverbindung oder versuche es später erneut.'
        : 'Die Online-Anmeldung ist für diese Bereitstellung noch nicht eingerichtet. Bitte prüfe die Vercel-Umgebungsvariablen.'
    } else {
      errorMessage.value = error?.message === 'Email not confirmed'
        ? 'Bitte bestätige zuerst deine E-Mail-Adresse.'
        : 'Benutzername oder Passwort ist nicht korrekt.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.sign-in-page { min-height: 100vh; display: grid; grid-template-columns: minmax(320px, 43%) 1fr; background: #08111f; }.sign-in-intro { position: relative; min-height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 44px clamp(32px,6vw,86px); overflow: hidden; color: #fff; background: linear-gradient(145deg,#0f2d5a,#1d4ed8 62%,#2563eb); }.sign-in-intro::before { content: ''; position: absolute; width: 530px; height: 530px; right: -210px; bottom: -165px; border: 1px solid rgba(191,219,254,.16); border-radius: 50%; box-shadow: 0 0 0 55px rgba(191,219,254,.04),0 0 0 110px rgba(191,219,254,.025); }.intro-brand { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; }.intro-brand > span,.mobile-logo { width: 39px; height: 39px; display: grid; place-items: center; border-radius: 12px; background: rgba(255,255,255,.16); }.intro-brand strong { font-size: 1rem; }.intro-copy { position: relative; z-index: 1; max-width: 410px; }.intro-copy p { margin: 0 0 13px; color: #bfdbfe; font-size: .72rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }.intro-copy h1 { margin: 0; font-size: clamp(2.25rem,4.6vw,4.1rem); letter-spacing: -.07em; line-height: .98; }.intro-copy h1 em { color: #bfdbfe; font-style: normal; }.intro-copy > span { display: block; max-width: 330px; margin-top: 24px; color: #dbeafe; font-size: .92rem; line-height: 1.65; }.intro-status { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }.intro-status span { display: inline-flex; align-items: center; gap: 6px; margin: 0; padding: 7px 9px; border: 1px solid rgba(219,234,254,.18); border-radius: 999px; color: #dbeafe; background: rgba(255,255,255,.09); font-size: .68rem; font-weight: 700; }.intro-dots { position: relative; z-index: 1; display: flex; gap: 7px; }.intro-dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.3); }.intro-dots i:first-child { width: 24px; border-radius: 5px; background: #fff; }.sign-in-content { display: grid; place-items: center; padding: 30px; background: radial-gradient(circle at 70% 15%,rgba(37,99,235,.1),transparent 23rem); }.sign-in-card { width: min(100%,410px); }.card-heading p { margin: 0 0 8px; color: #93c5fd; font-size: .72rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }.card-heading h2 { margin: 0; color: #f8fafc; font-size: 2rem; letter-spacing: -.05em; }.card-heading > span { display: block; margin-top: 10px; color: var(--text-secondary); font-size: .87rem; }.mobile-logo { display: none; margin-bottom: 22px; color: #dbeafe; background: #1e40af; }.setup-note,.error { display: flex; align-items: center; gap: 8px; margin: 24px 0 0; padding: 11px 12px; border-radius: 10px; font-size: .8rem; line-height: 1.4; }.setup-note { color: #fde68a; background: rgba(245,158,11,.12); }.error { color: #fecdd3; background: rgba(244,63,94,.12); }form { display: grid; gap: 18px; margin-top: 30px; }label { display: grid; gap: 8px; color: #cbd5e1; font-size: .77rem; font-weight: 700; }label > div { position: relative; display: flex; align-items: center; }label > div > i { position: absolute; left: 13px; color: #71809b; font-size: .85rem; }input { width: 100%; height: 47px; padding: 0 43px; border: 1px solid var(--line-strong); border-radius: 11px; outline: 0; color: #e2e8f0; background: #0d192b; font-size: .9rem; transition: .15s ease; }input:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(59,130,246,.14); }label button { position: absolute; right: 6px; width: 35px; height: 35px; border: 0; border-radius: 8px; color: #8ca0c0; background: transparent; cursor: pointer; }label small { color: var(--text-muted); font-size: .69rem; font-weight: 500; }.login-button { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; margin-top: 6px; border: 0; border-radius: 11px; color: #fff; background: linear-gradient(135deg,#2563eb,#3b82f6); box-shadow: 0 12px 22px rgba(37,99,235,.25); font-size: .86rem; font-weight: 800; cursor: pointer; }.login-button:hover { filter: brightness(1.07); }.login-button:disabled { opacity: .65; cursor: wait; }.login-assurance { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 20px; color: var(--text-muted); font-size: .68rem; font-weight: 700; }.login-assurance span { display: inline-flex; align-items: center; gap: 5px; }.login-assurance i { color: #60a5fa; }.help-copy { display: flex; align-items: flex-start; justify-content: center; gap: 7px; margin: 18px 0 0; color: #93c5fd; font-size: .76rem; line-height: 1.45; text-align: center; }
@media (max-width: 760px) { .sign-in-page { grid-template-columns: 1fr; }.sign-in-intro { min-height: 170px; padding: 24px; }.intro-copy,.intro-dots { display: none; }.sign-in-content { align-items: start; min-height: calc(100vh - 170px); padding: 42px 22px; }.mobile-logo { display: grid; }.sign-in-card { width: min(100%,440px); } }
</style>
