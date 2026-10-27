<template>
  <AppShell eyebrow="Konto" title="Profil & Einstellungen" description="Halte deine Kontakt- und Zugangsdaten aktuell.">
    <div class="profile-layout">
      <aside class="profile-summary"><span class="profile-avatar">{{ initials }}</span><h2>{{ userName }}</h2><p>{{ profileData.email || 'E-Mail wird geladen …' }}</p><div class="summary-note"><i class="fa-solid fa-shield-halved"></i><span>Deine Daten werden sicher über dein Konto verwaltet.</span></div></aside>
      <section class="settings-panel">
        <p v-if="successMessage" class="alert alert--success"><i class="fa-solid fa-circle-check"></i>{{ successMessage }}</p>
        <p v-if="errorMessage" class="alert alert--error"><i class="fa-solid fa-circle-exclamation"></i>{{ errorMessage }}</p>
        <form @submit.prevent="saveProfile">
          <section class="settings-section"><header><span><i class="fa-regular fa-address-card"></i></span><div><h2>Kontaktdaten</h2><p>Diese Daten helfen der Verwaltung, dich zu erreichen.</p></div></header><div class="form-grid"><label class="form-field form-field--wide"><span>E-Mail-Adresse</span><input v-model.trim="profileData.email" type="email" autocomplete="email" required></label><label class="form-field"><span>Telefonnummer</span><input v-model.trim="profileData.phone" type="tel" autocomplete="tel" placeholder="z. B. +43 660 1234567"></label></div></section>
          <section class="settings-section"><header><span><i class="fa-solid fa-location-dot"></i></span><div><h2>Adresse</h2><p>Optional für administrative Unterlagen.</p></div></header><div class="form-grid"><label class="form-field form-field--wide"><span>Straße & Hausnummer</span><input v-model.trim="profileData.street" autocomplete="street-address"></label><label class="form-field"><span>PLZ</span><input v-model.trim="profileData.zip" autocomplete="postal-code"></label><label class="form-field"><span>Ort</span><input v-model.trim="profileData.city" autocomplete="address-level2"></label></div></section>
          <section class="settings-section settings-section--last"><header><span><i class="fa-solid fa-key"></i></span><div><h2>Passwort ändern</h2><p>Nur ausfüllen, wenn du ein neues Passwort setzen möchtest.</p></div></header><div class="form-grid"><label class="form-field form-field--wide"><span>Neues Passwort</span><input v-model="profileData.newPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Mindestens 8 Zeichen"></label></div></section>
          <footer class="form-footer"><p>Änderungen an der E-Mail-Adresse müssen möglicherweise per E-Mail bestätigt werden.</p><button type="submit" :disabled="isSaving"><i class="fa-solid" :class="isSaving ? 'fa-spinner fa-spin' : 'fa-check'"></i>{{ isSaving ? 'Wird gespeichert …' : 'Änderungen speichern' }}</button></footer>
        </form>
      </section>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { supabase } from '../config/supabase.js'

const profileData = ref({ email: '', phone: '', street: '', zip: '', city: '', newPassword: '' })
const userName = ref('Mein Profil')
const successMessage = ref('')
const errorMessage = ref('')
const isSaving = ref(false)
const initials = computed(() => userName.value.split(/\s+/).filter(Boolean).slice(0, 2).map((name) => name[0]).join('').toUpperCase() || 'M')
const formatName = (email) => (email || 'Mein Profil').split('@')[0].split(/[._-]/).filter(Boolean).map((name) => name[0].toUpperCase() + name.slice(1)).join(' ')

const loadProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const metadata = user.user_metadata || {}
  const address = metadata.address || {}
  userName.value = metadata.full_name || metadata.name || formatName(user.email)
  profileData.value = { email: user.email || '', phone: metadata.phone || '', street: address.street || '', zip: address.zip || '', city: address.city || '', newPassword: '' }
}

const saveProfile = async () => {
  successMessage.value = ''; errorMessage.value = ''
  if (profileData.value.newPassword && profileData.value.newPassword.length < 8) { errorMessage.value = 'Das neue Passwort muss mindestens 8 Zeichen lang sein.'; return }
  isSaving.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')
    const emailChanged = profileData.value.email !== user.email
    const updates = { data: { ...user.user_metadata, phone: profileData.value.phone, address: { street: profileData.value.street, zip: profileData.value.zip, city: profileData.value.city } } }
    if (emailChanged) updates.email = profileData.value.email
    if (profileData.value.newPassword) updates.password = profileData.value.newPassword
    const { error } = await supabase.auth.updateUser(updates)
    if (error) throw error
    profileData.value.newPassword = ''
    successMessage.value = emailChanged ? 'Deine Daten wurden gespeichert. Bitte bestätige die neue E-Mail-Adresse.' : 'Deine Änderungen wurden gespeichert.'
  } catch (error) { errorMessage.value = error?.message || 'Die Änderungen konnten nicht gespeichert werden.' } finally { isSaving.value = false }
}

onMounted(loadProfile)
</script>

<style scoped>
.profile-layout { display: grid; grid-template-columns: 265px minmax(0, 1fr); gap: 20px; align-items: start; }.profile-summary, .settings-panel { border: 1px solid var(--line); border-radius: 20px; background: rgba(15,27,47,.8); box-shadow: 0 18px 42px rgba(2,6,23,.17); }.profile-summary { position: sticky; top: 26px; padding: 27px 22px; text-align: center; }.profile-avatar { width: 74px; height: 74px; display: grid; place-items: center; margin: 0 auto 15px; border: 3px solid rgba(147,197,253,.16); border-radius: 23px; color: #dbeafe; background: linear-gradient(135deg, #1e40af, #2563eb); box-shadow: 0 14px 26px rgba(37,99,235,.23); font-size: 1.35rem; font-weight: 800; }.profile-summary h2 { margin: 0; color: #fff; font-size: 1rem; letter-spacing: -.02em; }.profile-summary > p { overflow: hidden; margin: 7px 0 22px; color: var(--text-muted); font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; }.summary-note { display: flex; gap: 9px; padding: 12px; border: 1px solid rgba(96,165,250,.12); border-radius: 12px; color: #91a5c3; background: rgba(30,64,175,.12); font-size: .72rem; line-height: 1.4; text-align: left; }.summary-note i { color: #93c5fd; }.settings-panel { overflow: hidden; }.alert { display: flex; align-items: center; gap: 9px; margin: 20px 22px 0; padding: 11px 12px; border-radius: 10px; font-size: .8rem; }.alert--success { color: #bbf7d0; background: rgba(22,163,74,.13); }.alert--error { color: #fecdd3; background: rgba(244,63,94,.12); }.settings-section { padding: 25px; border-bottom: 1px solid var(--line); }.settings-section--last { border-bottom: 0; }.settings-section header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }.settings-section header > span { width: 37px; height: 37px; display: grid; place-items: center; border-radius: 11px; color: #bfdbfe; background: rgba(37,99,235,.16); }.settings-section h2 { margin: 0; color: #f8fafc; font-size: .98rem; }.settings-section header p { margin: 4px 0 0; color: var(--text-muted); font-size: .74rem; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }.form-field { display: grid; gap: 7px; color: #cbd5e1; font-size: .74rem; font-weight: 700; }.form-field--wide { grid-column: 1 / -1; }.form-field input { width: 100%; height: 43px; padding: 0 11px; border: 1px solid var(--line-strong); border-radius: 10px; outline: 0; color: #e2e8f0; background: #0a1526; font-size: .86rem; transition: .15s ease; }.form-field input:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(59,130,246,.14); }.form-footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 20px 25px; border-top: 1px solid var(--line); background: rgba(8,17,31,.28); }.form-footer p { max-width: 420px; margin: 0; color: var(--text-muted); font-size: .71rem; line-height: 1.45; }.form-footer button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 0 14px; border: 0; border-radius: 10px; color: #fff; background: #2563eb; font-size: .8rem; font-weight: 800; white-space: nowrap; cursor: pointer; }.form-footer button:hover { background: #3575ed; }.form-footer button:disabled { opacity: .65; cursor: wait; }
@media (max-width: 800px) { .profile-layout { grid-template-columns: 1fr; }.profile-summary { position: static; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 0 16px; padding: 18px; text-align: left; }.profile-avatar { grid-row: span 2; width: 54px; height: 54px; margin: 0; border-radius: 17px; font-size: 1rem; }.profile-summary > p { margin: 4px 0 0; }.summary-note { grid-column: 1 / -1; margin-top: 17px; }.settings-section { padding: 20px; }.form-footer { align-items: stretch; flex-direction: column; padding: 18px 20px; }.form-footer button { width: 100%; } }
@media (max-width: 480px) { .form-grid { grid-template-columns: 1fr; }.form-field--wide { grid-column: auto; } }
</style>
