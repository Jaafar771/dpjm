<template>
  <AppShell eyebrow="Direkter Draht" title="Büro Kontakt" description="Sende eine Nachricht an die Dienstplan-Verwaltung.">
    <div class="contact-layout">
      <aside class="contact-info"><span class="contact-icon"><i class="fa-solid fa-headset"></i></span><h2>Wir helfen gerne.</h2><p>Nutze dieses Formular für Fragen zu deinem Dienstplan, Urlaub oder Diensttausch.</p><div class="info-line"><i class="fa-solid fa-clock"></i><span>Antworten erfolgen in der Regel während der Bürozeiten.</span></div></aside>
      <section class="contact-form-panel"><p v-if="successMessage" class="alert alert--success"><i class="fa-solid fa-circle-check"></i>{{ successMessage }}</p><p v-if="errorMessage" class="alert alert--error"><i class="fa-solid fa-circle-exclamation"></i>{{ errorMessage }}</p><form @submit.prevent="sendMessage"><label><span>Thema</span><select v-model="formData.subject" required><option value="" disabled>Bitte auswählen</option><option value="Frage zum Dienstplan">Frage zum Dienstplan</option><option value="Krankmeldung nachreichen">Krankmeldung nachreichen</option><option value="Diensttausch / Urlaub">Diensttausch oder Urlaub</option><option value="Sonstiges">Sonstiges</option></select></label><label><span>Deine Nachricht</span><textarea v-model.trim="formData.message" rows="8" required placeholder="Beschreibe dein Anliegen so genau wie möglich …"></textarea></label><button type="submit" :disabled="isSending"><i class="fa-solid" :class="isSending ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>{{ isSending ? 'E-Mail wird geöffnet …' : 'Nachricht vorbereiten' }}</button></form></section>
    </div>
  </AppShell>
</template>

<script setup>
import { ref } from 'vue'
import AppShell from '../components/AppShell.vue'

const formData = ref({ subject: '', message: '' })
const isSending = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const sendMessage = () => {
  successMessage.value = ''; errorMessage.value = ''
  const targetEmail = import.meta.env.VITE_OFFICE_EMAIL?.trim()
  if (!targetEmail) { errorMessage.value = 'Die E-Mail-Adresse der Dienstplan-Verwaltung ist noch nicht eingerichtet.'; return }
  isSending.value = true
  const subject = encodeURIComponent(`[Dienstplan] ${formData.value.subject}`)
  const body = encodeURIComponent(`Nachricht:\n${formData.value.message}`)
  window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`
  successMessage.value = 'Deine E-Mail-App wird geöffnet.'
  formData.value = { subject: '', message: '' }
  isSending.value = false
}
</script>

<style scoped>
.contact-layout { display: grid; grid-template-columns: minmax(260px,.75fr) minmax(0,1.25fr); gap: 20px; }.contact-info, .contact-form-panel { border: 1px solid var(--line); border-radius: 20px; background: rgba(15,27,47,.8); box-shadow: 0 18px 42px rgba(2,6,23,.17); }.contact-info { padding: 28px; background: linear-gradient(145deg, rgba(30,64,175,.48), rgba(15,27,47,.92) 65%); }.contact-icon { width: 49px; height: 49px; display: grid; place-items: center; margin-bottom: 22px; border-radius: 15px; color: #dbeafe; background: rgba(147,197,253,.15); font-size: 1.25rem; }.contact-info h2 { margin: 0; color: #fff; font-size: 1.2rem; letter-spacing: -.03em; }.contact-info > p { margin: 10px 0 30px; color: #bdcae0; font-size: .85rem; line-height: 1.6; }.info-line { display: flex; gap: 9px; padding-top: 17px; border-top: 1px solid rgba(191,219,254,.14); color: #a8bbd8; font-size: .74rem; line-height: 1.45; }.info-line i { color: #93c5fd; }.contact-form-panel { padding: 28px; }.alert { display: flex; align-items: center; gap: 9px; margin: 0 0 18px; padding: 11px 12px; border-radius: 10px; font-size: .8rem; }.alert--success { color: #bbf7d0; background: rgba(22,163,74,.13); }.alert--error { color: #fecdd3; background: rgba(244,63,94,.12); }form { display: grid; gap: 18px; }label { display: grid; gap: 8px; color: #cbd5e1; font-size: .77rem; font-weight: 700; }select, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: 10px; outline: 0; color: #e2e8f0; background: #0a1526; font-size: .88rem; transition: .15s ease; }select { height: 44px; padding: 0 11px; }textarea { padding: 12px; resize: vertical; }select:focus, textarea:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(59,130,246,.14); }button { min-height: 45px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 11px; color: #fff; background: linear-gradient(135deg,#2563eb,#3b82f6); font-size: .84rem; font-weight: 800; cursor: pointer; }button:disabled { opacity: .65; cursor: wait; }
@media (max-width: 740px) { .contact-layout { grid-template-columns: 1fr; }.contact-info, .contact-form-panel { padding: 21px; }.contact-info > p { margin-bottom: 21px; } }
</style>
